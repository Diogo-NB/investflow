import { ConfigService } from '@nestjs/config';
import {
  EEconomicIndex,
  ETitleType,
  Curve,
  CurveInterval,
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
  IndexValue,
  InvestmentCalculator,
  InvestmentInputs,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  Simulation,
  SimulationCalculationCause,
  SimulationCalculationService,
  SimulationResult,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  generateUuid,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { Clock } from '@investflow/shared-application';
import {
  PrismaService,
  TransactionalDomainEventRecorder,
  UnitOfWork,
} from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { PrismaCurveRepository } from '../../../curves/persistence/prisma-curve.repository';
import { PrismaOfferRepository } from '../../../offers/persistence/prisma-offer.repository';
import { GetSimulationWorkspaceQueryHandler } from '../../../simulation-workspaces/queries/get-simulation-workspace.query-handler';
import { ListSimulationMonthlyBalancesQueryHandler } from '../../queries/list-simulation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from '../../queries/list-simulations.query-handler';
import { PrismaSimulationRepository } from '../prisma-simulation.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const connectionString = process.env['INTEGRATION_TEST_DATABASE_URL'];
if (!connectionString) {
  throw new Error(
    'INTEGRATION_TEST_DATABASE_URL is not set; run pnpm check:integration',
  );
}

const calculation = new SimulationCalculationService(
  new InvestmentCalculator(),
);

// Each save runs in its own unit of work, as a request would.
function inUnitOfWork<R extends { save(aggregate: never): Promise<unknown> }>(
  unitOfWork: UnitOfWork,
  repository: R,
): R {
  const save = repository.save.bind(repository);
  return Object.assign(repository, {
    save: (aggregate: never) => unitOfWork.run(() => save(aggregate)),
  });
}

describe('Simulation PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let unitOfWork: UnitOfWork;
  const clock: Clock = {
    now: () => UtcInstant.ofIso('2026-10-11T12:00:00Z'),
    today: () => CalendarDate.of('2026-10-11'),
  };
  const events = new TransactionalDomainEventRecorder(clock);
  let offers: PrismaOfferRepository;
  let curves: PrismaCurveRepository;
  let simulations: PrismaSimulationRepository;
  const issuerName = `Integration Simulation Bank ${generateUuid()}`;
  const ownerId = `owner-${generateUuid()}`;
  const curveIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: connectionString }),
    );
    unitOfWork = new UnitOfWork(prisma);
    await prisma.onModuleInit();
    offers = inUnitOfWork(
      unitOfWork,
      new PrismaOfferRepository(prisma, events),
    );
    curves = inUnitOfWork(
      unitOfWork,
      new PrismaCurveRepository(prisma, events),
    );
    simulations = inUnitOfWork(
      unitOfWork,
      new PrismaSimulationRepository(prisma, events),
    );
  });

  afterAll(async () => {
    try {
      const simulation = { ownerId };
      const simulationIds = (
        await prisma.client.simulation.findMany({
          where: simulation,
          select: { id: true },
        })
      ).map(({ id }) => id);
      await prisma.client.simulationCalculation.deleteMany({
        where: { simulation },
      });
      await prisma.client.simulationResultBalance.deleteMany({
        where: { result: { simulation } },
      });
      await prisma.client.simulationResult.deleteMany({
        where: { simulation },
      });
      await prisma.client.simulation.deleteMany({ where: simulation });
      const offerIds = (
        await prisma.client.offer.findMany({
          where: { issuerName },
          select: { id: true },
        })
      ).map(({ id }) => id);
      await prisma.client.offer.deleteMany({ where: { issuerName } });
      await prisma.client.curveInterval.deleteMany({
        where: { curveId: { in: curveIds } },
      });
      await prisma.client.curve.deleteMany({
        where: { id: { in: curveIds } },
      });
      await prisma.client.outboxEvent.deleteMany({
        where: {
          aggregateId: { in: [...curveIds, ...offerIds, ...simulationIds] },
        },
      });
    } finally {
      await prisma.onApplicationShutdown();
    }
  });

  const at = (iso: string) => UtcInstant.ofIso(`${iso}T12:00:00.000Z`);
  const cause = (
    kind = ESimulationCalculationCauseKind.CREATED,
  ): SimulationCalculationCause => ({ kind, actorId: ownerId });
  const EDITED = cause(ESimulationCalculationCauseKind.SIMULATION_EDITED);

  // A saved simulation of a CDI title over about one year of business days.
  async function savedSimulation(titleType = ETitleType.CDB) {
    const curve = Curve.create(
      {
        ownerId: null,
        index: EEconomicIndex.CDI,
        name: 'Integration CDI',
        intervals: [
          CurveInterval.create(
            CalendarDateRange.of(
              CalendarDate.of('2026-01-01'),
              CalendarDate.of('2026-12-31'),
            ),
            IndexValue.of('0.1415'),
          ),
        ],
      },
      at('2026-10-09'),
    ).value;
    curveIds.push(curve.id);
    const offer = Offer.create(
      {
        ownerId: null,
        titleType,
        name: 'Integration 105% do CDI',
        issuerName,
        maturityDate: CalendarDate.of('2027-01-04'),
        redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
        remunerationTerms: RemunerationTerms.create(
          'CDI_PERCENTAGE',
          Rate.of('1.05'),
        ),
      },
      at('2026-10-09'),
    ).value;
    const created = Simulation.create(
      { ownerId, offerId: offer.id, investment: investmentOf(curve) },
      cause(),
      at('2026-10-09'),
    );
    for (const save of [
      () => curves.save(curve),
      () => offers.save(offer),
      () => simulations.save(created),
    ]) {
      expect((await save()).isOk()).toBe(true);
    }
    const simulation = await calculated(created.id, offer, curve, '2026-10-09');
    return { simulation, offer, curve };
  }

  // What the calculation worker does: read, calculate, record, save.
  async function calculated(
    id: string,
    offer: Offer,
    curve: Curve,
    iso: string,
  ) {
    const simulation = await load(id);
    simulation.recordCalculation(
      calculation.calculate(simulation, offer, curve, at(iso)),
      at(iso),
    );
    expect((await simulations.save(simulation)).isOk()).toBe(true);
    return simulation;
  }

  function investmentOf(curve: Curve, principal = '10000.123456789') {
    return InvestmentInputs.create({
      principal: Money.of(principal),
      investmentDate: CalendarDate.of('2026-01-02'),
      curveId: curve.id,
    });
  }

  async function load(id: string) {
    return (await simulations.findOwned(id, ownerId)).value;
  }

  function fingerprintOf(
    simulationRevision: number,
    offer: Offer,
    curve: Curve,
  ) {
    return SimulationResult.inputFingerprintFor({
      simulationRevision,
      offer,
      curveValuesRevision: curve.valuesRevision,
    });
  }

  it('restores a simulation only for its owner and while it is not deleted', async () => {
    const { simulation } = await savedSimulation();

    const loaded = await load(simulation.id);
    expect(loaded.offerId).toBe(simulation.offerId);
    expect(loaded.revision).toBe(1);
    expect((await simulations.findById(simulation.id)).isOk()).toBe(true);
    expect(
      (await simulations.findOwned(simulation.id, 'someone-else')).error.code,
    ).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);

    loaded.delete(at('2026-10-13'));
    expect((await simulations.save(loaded)).isOk()).toBe(true);
    expect((await simulations.findById(simulation.id)).error.code).toBe(
      EAppErrorCode.SIMULATION_NOT_FOUND,
    );
  });

  it('saves a new simulation waiting for its calculation with its event', async () => {
    const { offer, curve } = await savedSimulation();
    const created = Simulation.create(
      { ownerId, offerId: offer.id, investment: investmentOf(curve) },
      cause(),
      at('2026-10-09'),
    );
    const [event] = created.getDomainEvents();

    expect((await simulations.save(created)).isOk()).toBe(true);

    const loaded = await load(created.id);
    expect(loaded.result).toBeNull();
    expect(loaded.calculation.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
    expect(loaded.calculation.cause).toEqual(cause());
    expect(
      await prisma.client.outboxEvent.findUnique({
        where: { id: event.eventId },
        select: { eventType: true, aggregateId: true },
      }),
    ).toEqual({
      eventType: 'SimulationCreated',
      aggregateId: created.id,
    });
  });

  it('discards an outcome calculated before a later edit', async () => {
    const { simulation, offer, curve } = await savedSimulation();
    const worker = await load(simulation.id);
    const user = await load(simulation.id);
    user.edit(
      { offerId: offer.id, investment: investmentOf(curve, '20000') },
      EDITED,
      at('2026-10-10'),
    );
    expect((await simulations.save(user)).isOk()).toBe(true);

    worker.recordCalculation(
      calculation.calculate(worker, offer, curve, at('2026-10-10')),
      at('2026-10-10'),
    );

    expect((await simulations.save(worker)).error.code).toBe(
      EAppErrorCode.SIMULATION_CALCULATION_STALE,
    );
    const reloaded = await load(simulation.id);
    expect(reloaded.revision).toBe(2);
    expect(reloaded.calculation.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
    expect(reloaded.calculation.cause).toEqual(EDITED);
    expect(reloaded.calculation.inputFingerprint).toBeNull();
    expect(
      reloaded.result?.inputFingerprint.equals(fingerprintOf(1, offer, curve)),
    ).toBe(true);
  });

  it('records a failure only over a calculation still pending', async () => {
    const { simulation, offer, curve } = await savedSimulation();
    const requested = await load(simulation.id);
    requested.requestCalculation(
      cause(ESimulationCalculationCauseKind.RETRY_REQUESTED),
      at('2026-10-10'),
    );
    expect((await simulations.save(requested)).isOk()).toBe(true);
    const deadLetter = await load(simulation.id);
    await calculated(simulation.id, offer, curve, '2026-10-11');

    deadLetter.markCalculationFailed(at('2026-10-12'));

    expect((await simulations.save(deadLetter)).error.code).toBe(
      EAppErrorCode.SIMULATION_CALCULATION_STALE,
    );
    expect((await load(simulation.id)).calculation.status).toBe(
      ESimulationCalculationStatus.CALCULATED,
    );

    const pending = await load(simulation.id);
    pending.requestCalculation(EDITED, at('2026-10-12'));
    expect((await simulations.save(pending)).isOk()).toBe(true);
    const failing = await load(simulation.id);
    failing.markCalculationFailed(at('2026-10-13'));
    expect((await simulations.save(failing)).isOk()).toBe(true);
    expect((await load(simulation.id)).calculation.status).toBe(
      ESimulationCalculationStatus.FAILED,
    );
  });

  it('stores a full year of daily balances and restores the result exactly', async () => {
    const { simulation } = await savedSimulation();
    const result = simulation.result?.projection;
    expect(result?.dailyBalances.length).toBeGreaterThan(240);

    const loaded = (await load(simulation.id)).result;

    expect(
      loaded?.inputFingerprint.equals(simulation.result!.inputFingerprint),
    ).toBe(true);
    expect(loaded?.calculatedAt.equals(at('2026-10-09'))).toBe(true);
    expect(loaded?.projection.equals(result!)).toBe(true);
    expect(loaded?.projection.net.finalBalance.amount.toFixed()).toBe(
      result?.net.finalBalance.amount.toFixed(),
    );
    expect(loaded?.projection.dailyBalances).toHaveLength(
      result?.dailyBalances.length ?? 0,
    );
    loaded?.projection.dailyBalances.forEach((balance, index) => {
      const original = result?.dailyBalances[index];
      expect(balance.date.toIsoString()).toBe(original?.date.toIsoString());
      expect(balance.grossBalance.amount.toFixed()).toBe(
        original?.grossBalance.amount.toFixed(),
      );
      expect(balance.accumulatedGrossEarnings.amount.toFixed()).toBe(
        original?.accumulatedGrossEarnings.amount.toFixed(),
      );
    });
  });

  it('stores an LCI income tax exemption as a null rate', async () => {
    const { simulation, offer, curve } = await savedSimulation(ETitleType.LCI);

    const reloaded = (await load(simulation.id)).result;
    const loaded = reloaded?.projection;

    expect(
      reloaded?.inputFingerprint.equals(fingerprintOf(1, offer, curve)),
    ).toBe(true);
    expect(loaded?.taxes.incomeTax.rate).toBeNull();
    expect(loaded?.taxes.incomeTax.amount.isZero).toBe(true);
  });

  it('replaces the result and its balances when an edit is calculated', async () => {
    const { simulation, offer, curve } = await savedSimulation();
    const loaded = await load(simulation.id);
    const shorter = Offer.create(
      {
        ownerId,
        titleType: ETitleType.CDB,
        name: 'Integration curta',
        issuerName,
        maturityDate: CalendarDate.of('2026-03-02'),
        redemptionTerms: offer.redemptionTerms,
        remunerationTerms: offer.remunerationTerms,
      },
      at('2026-10-10'),
    ).value;
    expect((await offers.save(shorter)).isOk()).toBe(true);

    loaded.edit(
      { offerId: shorter.id, investment: investmentOf(curve, '20000') },
      EDITED,
      at('2026-10-10'),
    );
    expect((await simulations.save(loaded)).isOk()).toBe(true);
    const recalculated = await calculated(
      simulation.id,
      shorter,
      curve,
      '2026-10-10',
    );

    const reloaded = await load(simulation.id);
    expect(reloaded.revision).toBe(2);
    expect(reloaded.offerId).toBe(shorter.id);
    expect(
      reloaded.result?.inputFingerprint.equals(
        fingerprintOf(2, shorter, curve),
      ),
    ).toBe(true);
    expect(
      await prisma.client.simulationResultBalance.count({
        where: { simulationId: simulation.id },
      }),
    ).toBe(recalculated.result?.projection.dailyBalances.length);
    expect(
      reloaded.result?.projection.dailyBalances.at(-1)?.date.toIsoString(),
    ).toBe('2026-03-02');
  });

  it('rejects saving a simulation changed elsewhere since it was read', async () => {
    const { simulation, offer, curve } = await savedSimulation();
    const first = await load(simulation.id);
    const second = await load(simulation.id);
    const edit = (target: Simulation, principal: string) =>
      target.edit(
        { offerId: offer.id, investment: investmentOf(curve, principal) },
        EDITED,
        at('2026-10-10'),
      );

    edit(first, '20000');
    expect((await simulations.save(first)).isOk()).toBe(true);
    edit(second, '30000');

    expect((await simulations.save(second)).error.code).toBe(
      EAppErrorCode.SIMULATION_REVISION_CONFLICT,
    );
    expect(
      (await load(simulation.id)).investment.principal.equals(
        Money.of('20000'),
      ),
    ).toBe(true);
  });

  it('reads the result as outdated after its offer changes until it is calculated again', async () => {
    const { simulation, offer, curve } = await savedSimulation();
    const workspace = new GetSimulationWorkspaceQueryHandler(prisma, {
      today: () => CalendarDate.of('2026-10-16'),
    } as Clock);
    const list = new ListSimulationsQueryHandler(prisma);
    const read = async () => ({
      workspace: (
        await workspace.execute({ ownerId, simulationId: simulation.id })
      ).value,
      listed: (
        await list.execute({ ownerId, page: 1, pageSize: 100 })
      ).value.items.find((item) => item.id === simulation.id),
    });

    const before = await read();
    expect(before.workspace.simulation).toEqual({
      id: simulation.id,
      revision: 1,
      investment: {
        principal: '10000.123456789',
        investmentDate: '2026-01-02',
        curveId: curve.id,
      },
    });
    expect(before.workspace.offer).toMatchObject({
      id: offer.id,
      origin: 'SYSTEM',
      revision: 1,
      deleted: false,
    });
    expect(before.workspace.result?.outdated).toBe(false);
    expect(before.workspace.remainingTerm).toEqual({
      phase: 'RUNNING',
      calendarDays: 80,
      years: 0,
      months: 2,
      days: 19,
    });
    expect(before.workspace.result?.gross.rateOfReturn.annual).toBe(
      simulation.result?.projection.gross.rateOfReturn.annual.toFixed(),
    );
    expect(before.listed).toMatchObject({
      offerName: 'Integration 105% do CDI',
      issuerName,
      maturityDate: '2027-01-04',
      result: { outdated: false },
    });

    const renamed = (await offers.findById(offer.id)).value;
    renamed.edit({ name: 'Integration renomeada' }, at('2026-10-09'));
    expect((await offers.save(renamed)).isOk()).toBe(true);
    const afterRename = await read();
    expect(afterRename.workspace.result?.outdated).toBe(false);
    expect(afterRename.listed?.result?.outdated).toBe(false);

    const edited = (await offers.findById(offer.id)).value;
    edited.edit(
      {
        remunerationTerms: RemunerationTerms.create(
          'CDI_PERCENTAGE',
          Rate.of('1.1'),
        ),
      },
      at('2026-10-10'),
    );
    expect((await offers.save(edited)).isOk()).toBe(true);
    const changed = await read();
    expect(changed.workspace.result?.outdated).toBe(true);
    expect(changed.listed?.result?.outdated).toBe(true);

    const loaded = await load(simulation.id);
    loaded.edit(
      { offerId: edited.id, investment: loaded.investment },
      EDITED,
      at('2026-10-11'),
    );
    expect((await simulations.save(loaded)).isOk()).toBe(true);
    const queued = await read();
    expect(queued.workspace.calculation).toEqual({
      status: 'PENDING',
      changedAt: '2026-10-11T12:00:00.000Z',
      cause: { kind: 'SIMULATION_EDITED' },
      reason: null,
    });
    expect(queued.listed?.calculationStatus).toBe('PENDING');
    await calculated(simulation.id, edited, curve, '2026-10-11');
    const recalculated = await read();
    expect(recalculated.workspace.calculation.status).toBe('CALCULATED');
    expect(recalculated.workspace.simulation.revision).toBe(1);
    expect(recalculated.workspace.result).toMatchObject({
      calculatedAt: '2026-10-11T12:00:00.000Z',
      outdated: false,
    });
    expect(
      (
        await workspace.execute({
          ownerId: 'someone-else',
          simulationId: simulation.id,
        })
      ).error.code,
    ).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
  });

  it('groups the result by month and hides it with its simulation', async () => {
    const { simulation, curve } = await savedSimulation();
    const result = simulation.result?.projection;
    const get = new ListSimulationMonthlyBalancesQueryHandler(prisma);
    const query = { ownerId, simulationId: simulation.id };

    expect((await curves.save(curve.delete(at('2026-10-12')))).isOk()).toBe(
      true,
    );
    const months = (await get.execute(query)).value.items;
    // January 2026 through January 2027, in order, covering every recorded day.
    expect(months.map(({ month }) => month)).toEqual([
      ...Array.from(
        { length: 12 },
        (_, index) => `2026-${String(index + 1).padStart(2, '0')}`,
      ),
      '2027-01',
    ]);
    expect(months.flatMap(({ days }) => days)).toHaveLength(
      result?.dailyBalances.length ?? 0,
    );
    const total = months.reduce(
      (sum, month) => sum.plus(month.monthGrossEarnings),
      new Prisma.Decimal(0),
    );
    expect(total.equals(result?.gross.earnings.amount.toFixed() ?? '')).toBe(
      true,
    );
    expect(
      (await get.execute({ ...query, ownerId: 'someone-else' })).error.code,
    ).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);

    const loaded = await load(simulation.id);
    expect(
      (await simulations.save(loaded.delete(at('2026-10-13')))).isOk(),
    ).toBe(true);
    expect((await get.execute(query)).error.code).toBe(
      EAppErrorCode.SIMULATION_NOT_FOUND,
    );
  });

  it('finds the live simulations using an offer or a curve', async () => {
    const { simulation, offer, curve } = await savedSimulation();
    const sibling = Simulation.create(
      { ownerId, offerId: offer.id, investment: investmentOf(curve) },
      cause(),
      at('2026-10-09'),
    );
    const deleted = Simulation.create(
      { ownerId, offerId: offer.id, investment: investmentOf(curve) },
      cause(),
      at('2026-10-09'),
    );
    expect((await simulations.save(sibling)).isOk()).toBe(true);
    expect((await simulations.save(deleted)).isOk()).toBe(true);
    const loaded = await load(deleted.id);
    expect(
      (await simulations.save(loaded.delete(at('2026-10-10')))).isOk(),
    ).toBe(true);
    const other = await savedSimulation();

    const byOffer = (await simulations.findIdsByOffer(offer.id)).value;
    const byCurve = (await simulations.findIdsByCurve(curve.id)).value;

    expect([...byOffer].sort()).toEqual([simulation.id, sibling.id].sort());
    expect([...byCurve].sort()).toEqual([simulation.id, sibling.id].sort());
    expect(byOffer).not.toContain(other.simulation.id);
  });

  it('prevents removing an offer or curve that a simulation references', async () => {
    const { offer, curve } = await savedSimulation();

    await expect(
      prisma.client.offer.delete({ where: { id: offer.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.client.curve.delete({ where: { id: curve.id } }),
    ).rejects.toThrow();
  });

  it("searches the owner's simulations by offer name or issuer, ignoring case", async () => {
    const { simulation } = await savedSimulation();
    const list = new ListSimulationsQueryHandler(prisma);
    const ids = async (q: string) =>
      (
        await list.execute({ ownerId, page: 1, pageSize: 100, q })
      ).value.items.map((item) => item.id);

    expect(await ids('INTEGRATION 105')).toContain(simulation.id);
    expect(await ids(issuerName.slice(-12).toUpperCase())).toContain(
      simulation.id,
    );
    expect(await ids('Sem correspondência')).toEqual([]);
    expect(
      (
        await list.execute({
          ownerId: `other-${generateUuid()}`,
          page: 1,
          pageSize: 100,
          q: issuerName,
        })
      ).value.total,
    ).toBe(0);
  });

  it('lists by net annual return, simulations without a result last', async () => {
    const { offer, curve } = await savedSimulation(ETitleType.LCI);
    await savedSimulation(ETitleType.CDB);
    const uncalculated = Simulation.create(
      { ownerId, offerId: offer.id, investment: investmentOf(curve) },
      cause(),
      at('2026-10-09'),
    );
    expect((await simulations.save(uncalculated)).isOk()).toBe(true);
    const list = new ListSimulationsQueryHandler(prisma);

    const { items, total } = (
      await list.execute({
        ownerId,
        page: 1,
        pageSize: 100,
        sort: 'netAnnualReturn',
      })
    ).value;

    expect(items).toHaveLength(total);
    const firstWithout = items.findIndex((item) => !item.result);
    expect(firstWithout).toBeGreaterThan(0);
    expect(items.slice(firstWithout).every((item) => !item.result)).toBe(true);
    const returns = items
      .slice(0, firstWithout)
      .map((item) => new Prisma.Decimal(item.result?.netAnnualReturn ?? ''));
    returns.slice(1).forEach((value, index) => {
      expect(value.lessThanOrEqualTo(returns[index])).toBe(true);
    });
    // The exempt LCI earns more after taxes than the same CDB.
    expect(items[0].titleType).toBe('LCI');

    const paged = (
      await list.execute({
        ownerId,
        page: 2,
        pageSize: firstWithout,
        sort: 'netAnnualReturn',
      })
    ).value.items;
    expect(paged[0].id).toBe(items[firstWithout].id);
  });
});
