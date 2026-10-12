import { ConfigService } from '@nestjs/config';
import {
  EEconomicIndex,
  ETitleType,
  Curve,
  CurveInterval,
  IndexValue,
  InvestmentCalculator,
  InvestmentInputs,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  Simulation,
} from '@investflow/investment-simulator-domain';
import {
  BrazilianBusinessDayCalendar,
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  generateUuid,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { PrismaCurveRepository } from '../../curves/persistence/prisma-curve.repository';
import { PrismaOfferRepository } from '../../offers/persistence/prisma-offer.repository';
import { GetSimulationWorkspaceQueryHandler } from '../../simulation-workspaces/queries/get-simulation-workspace.query-handler';
import { ListSimulationMonthlyBalancesQueryHandler } from '../queries/list-simulation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from '../queries/list-simulations.query-handler';
import { PrismaSimulationRepository } from './prisma-simulation.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

// Run against a database with the migrations already applied.
const connectionString = process.env['INVESTMENT_SIMULATOR_TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

const calculator = new InvestmentCalculator(new BrazilianBusinessDayCalendar());

integration('Simulation PostgreSQL persistence', () => {
  let prisma: PrismaService;
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
    await prisma.onModuleInit();
    offers = new PrismaOfferRepository(prisma);
    curves = new PrismaCurveRepository(prisma);
    simulations = new PrismaSimulationRepository(prisma);
  });

  afterAll(async () => {
    try {
      const simulation = { ownerId };
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
        where: { aggregateId: { in: [...curveIds, ...offerIds] } },
      });
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  const at = (iso: string) => UtcInstant.ofIso(`${iso}T12:00:00.000Z`);

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
    const simulation = Simulation.create({
      ownerId,
      offer,
      investment: investmentOf(curve),
      curve,
      calculator,
      calculatedAt: at('2026-10-09'),
    }).value;
    for (const save of [
      () => curves.save(curve),
      () => offers.save(offer),
      () => simulations.save(simulation),
    ]) {
      expect((await save()).isOk()).toBe(true);
    }
    return { simulation, offer, curve };
  }

  function investmentOf(curve: Curve, principal = '10000.123456789') {
    return InvestmentInputs.create({
      principal: Money.of(principal),
      investmentDate: CalendarDate.of('2026-01-02'),
      curveId: curve.id,
    });
  }

  async function load(id: string) {
    return (await simulations.findById(id, ownerId)).value;
  }

  it('restores a simulation only for its owner and while it is not deleted', async () => {
    const { simulation } = await savedSimulation();

    const loaded = await load(simulation.id);
    expect(loaded.offerId).toBe(simulation.offerId);
    expect(loaded.revision).toBe(1);
    expect(
      (await simulations.findById(simulation.id, 'someone-else')).error.code,
    ).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);

    loaded.delete(at('2026-10-13'));
    expect((await simulations.save(loaded)).isOk()).toBe(true);
    expect(
      (await simulations.findById(simulation.id, ownerId)).error.code,
    ).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
  });

  it('stores a full year of daily balances and restores the result exactly', async () => {
    const { simulation } = await savedSimulation();
    const result = simulation.result?.calculation;
    expect(result?.dailyBalances.length).toBeGreaterThan(240);

    const loaded = (await load(simulation.id)).result;

    expect(loaded?.inputs).toEqual(simulation.result?.inputs);
    expect(loaded?.calculatedAt.equals(at('2026-10-09'))).toBe(true);
    for (const key of Object.keys(
      result?.maturitySummary ?? {},
    ) as (keyof NonNullable<typeof result>['maturitySummary'])[]) {
      expect(loaded?.calculation.maturitySummary[key].amount.toFixed()).toBe(
        result?.maturitySummary[key].amount.toFixed(),
      );
    }
    expect(loaded?.calculation.dailyBalances).toHaveLength(
      result?.dailyBalances.length ?? 0,
    );
    loaded?.calculation.dailyBalances.forEach((balance, index) => {
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
    const { simulation } = await savedSimulation(ETitleType.LCI);

    const loaded = (await load(simulation.id)).result?.calculation;

    expect(loaded?.methodologyVersion).toBe('lci-252-v1');
    expect(loaded?.taxes.incomeTax.rate).toBeNull();
    expect(loaded?.taxes.incomeTax.amount.isZero()).toBe(true);
  });

  it('replaces the result and its balances when an edit recalculates', async () => {
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

    loaded.edit({
      offer: shorter,
      investment: investmentOf(curve, '20000'),
      curve,
      calculator,
      calculatedAt: at('2026-10-10'),
    });
    expect((await simulations.save(loaded)).isOk()).toBe(true);

    const reloaded = await load(simulation.id);
    expect(reloaded.revision).toBe(2);
    expect(reloaded.offerId).toBe(shorter.id);
    expect(reloaded.result?.inputs.simulationRevision).toBe(2);
    expect(
      await prisma.client.simulationResultBalance.count({
        where: { simulationId: simulation.id },
      }),
    ).toBe(loaded.result?.calculation.dailyBalances.length);
    expect(
      reloaded.result?.calculation.dailyBalances.at(-1)?.date.toIsoString(),
    ).toBe('2026-03-02');
  });

  it('rejects saving a simulation changed elsewhere since it was read', async () => {
    const { simulation, offer, curve } = await savedSimulation();
    const first = await load(simulation.id);
    const second = await load(simulation.id);
    const edit = (target: Simulation, principal: string) =>
      target.edit({
        offer,
        investment: investmentOf(curve, principal),
        curve,
        calculator,
        calculatedAt: at('2026-10-10'),
      });

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

  it('reads the result as outdated after its offer changes until the simulation is saved again', async () => {
    const { simulation, offer, curve } = await savedSimulation();
    const workspace = new GetSimulationWorkspaceQueryHandler(prisma);
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
    expect(before.listed).toMatchObject({
      offerName: 'Integration 105% do CDI',
      issuerName,
      maturityDate: '2027-01-04',
      result: { outdated: false },
    });

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
    loaded.edit({
      offer: edited,
      investment: loaded.investment,
      curve,
      calculator,
      calculatedAt: at('2026-10-11'),
    });
    expect((await simulations.save(loaded)).isOk()).toBe(true);
    const recalculated = await read();
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
    const result = simulation.result?.calculation;
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
    expect(
      total.equals(
        result?.maturitySummary.grossEarnings.amount.toFixed() ?? '',
      ),
    ).toBe(true);
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

  it('prevents removing an offer or curve that a simulation references', async () => {
    const { offer, curve } = await savedSimulation();

    await expect(
      prisma.client.offer.delete({ where: { id: offer.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.client.curve.delete({ where: { id: curve.id } }),
    ).rejects.toThrow();
  });
});
