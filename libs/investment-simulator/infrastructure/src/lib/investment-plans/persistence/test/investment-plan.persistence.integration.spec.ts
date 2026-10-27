import { ConfigService } from '@nestjs/config';
import {
  ESimulationCalculationCauseKind,
  ETitleType,
  InvestmentCalculator,
  InvestmentInputs,
  InvestmentPlan,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  Simulation,
  SimulationCalculationService,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
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
import { PrismaOfferRepository } from '../../../offers/persistence/prisma-offer.repository';
import { PrismaSimulationRepository } from '../../../simulations/persistence/prisma-simulation.repository';
import { ListSimulationsQueryHandler } from '../../../simulations/queries/list-simulations.query-handler';
import { GetInvestmentPlanQueryHandler } from '../../queries/get-investment-plan.query-handler';
import { ListInvestmentPlansQueryHandler } from '../../queries/list-investment-plans.query-handler';
import { PrismaInvestmentPlanRepository } from '../prisma-investment-plan.repository';

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

describe('InvestmentPlan PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let unitOfWork: UnitOfWork;
  const clock: Clock = {
    now: () => UtcInstant.ofIso('2026-10-27T12:00:00Z'),
    today: () => CalendarDate.of('2026-10-27'),
  };
  const events = new TransactionalDomainEventRecorder(clock);
  let offers: PrismaOfferRepository;
  let simulations: PrismaSimulationRepository;
  let plans: PrismaInvestmentPlanRepository;
  const issuerName = `Integration Plan Bank ${generateUuid()}`;
  const ownerId = `owner-${generateUuid()}`;
  const otherOwnerId = `owner-${generateUuid()}`;

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
    simulations = inUnitOfWork(
      unitOfWork,
      new PrismaSimulationRepository(prisma, events),
    );
    plans = inUnitOfWork(
      unitOfWork,
      new PrismaInvestmentPlanRepository(prisma, events),
    );
  });

  afterAll(async () => {
    try {
      const owners = { in: [ownerId, otherOwnerId] };
      const simulation = { ownerId: owners };
      await prisma.client.investmentPlanSimulation.deleteMany({
        where: { investmentPlan: { ownerId: owners } },
      });
      await prisma.client.investmentPlan.deleteMany({
        where: { ownerId: owners },
      });
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
      await prisma.client.outboxEvent.deleteMany({
        where: { aggregateId: { in: [...offerIds, ...simulationIds] } },
      });
    } finally {
      await prisma.onApplicationShutdown();
    }
  });

  const at = (iso: string) => UtcInstant.ofIso(`${iso}T12:00:00.000Z`);
  const cause = {
    kind: ESimulationCalculationCauseKind.CREATED,
    actorId: ownerId,
  };

  async function savedOffer(rate = '0.12') {
    const offer = Offer.create(
      {
        ownerId: null,
        titleType: ETitleType.CDB,
        name: 'Integration prefixado',
        issuerName,
        maturityDate: CalendarDate.of('2027-01-04'),
        redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
        remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of(rate)),
      },
      at('2026-10-01'),
    ).value;
    expect((await offers.save(offer)).isOk()).toBe(true);
    return offer;
  }

  // Waiting for its first calculation.
  async function savedSimulation(offer: Offer, owner = ownerId) {
    const simulation = Simulation.create(
      {
        ownerId: owner,
        offerId: offer.id,
        investment: InvestmentInputs.create({
          principal: Money.of('10000'),
          investmentDate: CalendarDate.of('2026-01-02'),
          curveId: null,
        }),
      },
      cause,
      at('2026-10-01'),
    );
    expect((await simulations.save(simulation)).isOk()).toBe(true);
    return simulation;
  }

  async function calculated(simulation: Simulation, offer: Offer) {
    const loaded = (await simulations.findById(simulation.id)).value;
    loaded.recordCalculation(
      calculation.calculate(loaded, offer, null, at('2026-10-02')),
      at('2026-10-02'),
    );
    expect((await simulations.save(loaded)).isOk()).toBe(true);
  }

  async function deleted(simulation: Simulation) {
    const loaded = (await simulations.findById(simulation.id)).value;
    expect(
      (await simulations.save(loaded.delete(at('2026-10-03')))).isOk(),
    ).toBe(true);
  }

  async function savedPlan(name = 'Reserva', simulationIds: string[] = []) {
    const plan = InvestmentPlan.create({ ownerId, name }).value;
    plan.addSimulations(simulationIds);
    expect((await plans.save(plan)).isOk()).toBe(true);
    return plan;
  }

  const load = async (id: string) => (await plans.findOwned(id, ownerId)).value;
  const memberRows = (investmentPlanId: string) =>
    prisma.client.investmentPlanSimulation.findMany({
      where: { investmentPlanId },
      select: { simulationId: true },
    });
  const sorted = (ids: readonly string[]) => [...ids].sort();

  it('restores a plan only for its owner and while it is not deleted', async () => {
    const plan = await savedPlan('Aposentadoria');

    const loaded = await load(plan.id);
    expect(loaded.name).toBe('Aposentadoria');
    expect(loaded.description).toBeNull();
    expect(loaded.revision).toBe(1);
    expect((await plans.findOwned(plan.id, otherOwnerId)).error.code).toBe(
      EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND,
    );

    loaded.editDetails({ description: 'Longo prazo' });
    expect((await plans.save(loaded)).isOk()).toBe(true);
    expect((await load(plan.id)).description).toBe('Longo prazo');

    const removed = await load(plan.id);
    expect((await plans.save(removed.delete(at('2026-10-27')))).isOk()).toBe(
      true,
    );
    expect((await plans.findById(plan.id)).error.code).toBe(
      EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND,
    );
  });

  it('writes only the members added and removed', async () => {
    const offer = await savedOffer();
    const [a, b, c] = await Promise.all(
      [1, 2, 3].map(() => savedSimulation(offer)),
    );
    const plan = await savedPlan('Diff', [a.id, b.id]);
    expect(
      sorted((await memberRows(plan.id)).map((r) => r.simulationId)),
    ).toEqual(sorted([a.id, b.id]));

    const loaded = await load(plan.id);
    loaded.removeSimulation(a.id);
    loaded.addSimulations([c.id]);
    expect((await plans.save(loaded)).isOk()).toBe(true);

    const reloaded = await load(plan.id);
    expect(sorted(reloaded.simulationIds)).toEqual(sorted([b.id, c.id]));
    expect(reloaded.revision).toBe(2);
    expect(
      sorted((await memberRows(plan.id)).map((r) => r.simulationId)),
    ).toEqual(sorted([b.id, c.id]));
  });

  it('lets only the first of two concurrent adds through', async () => {
    const offer = await savedOffer();
    const [a, b] = await Promise.all([
      savedSimulation(offer),
      savedSimulation(offer),
    ]);
    const plan = await savedPlan('Concorrente');
    const first = await load(plan.id);
    const second = await load(plan.id);

    first.addSimulations([a.id]);
    second.addSimulations([b.id]);
    expect((await plans.save(first)).isOk()).toBe(true);

    expect((await plans.save(second)).error.code).toBe(
      EAppErrorCode.INVESTMENT_PLAN_REVISION_CONFLICT,
    );
    expect((await load(plan.id)).simulationIds).toEqual([a.id]);
    expect(await memberRows(plan.id)).toEqual([{ simulationId: a.id }]);
  });

  it('leaves out deleted simulations, which free their slot', async () => {
    const offer = await savedOffer();
    const members: Simulation[] = [];
    for (let i = 0; i < InvestmentPlan.SIMULATION_LIMIT; i++) {
      members.push(await savedSimulation(offer));
    }
    const extra = await savedSimulation(offer);
    const plan = await savedPlan(
      'Cheio',
      members.map(({ id }) => id),
    );
    const full = await load(plan.id);
    expect(full.addSimulations([extra.id]).error.code).toBe(
      EAppErrorCode.INVESTMENT_PLAN_SIMULATION_LIMIT,
    );

    await deleted(members[0]);
    const loaded = await load(plan.id);
    expect(loaded.simulationIds).not.toContain(members[0].id);
    expect(loaded.simulationIds).toHaveLength(
      InvestmentPlan.SIMULATION_LIMIT - 1,
    );

    expect(loaded.addSimulations([extra.id]).isOk()).toBe(true);
    expect((await plans.save(loaded)).isOk()).toBe(true);
    expect((await load(plan.id)).simulationIds).toHaveLength(
      InvestmentPlan.SIMULATION_LIMIT,
    );
    // The deleted simulation's row stays; reads skip it.
    expect(await memberRows(plan.id)).toHaveLength(
      InvestmentPlan.SIMULATION_LIMIT + 1,
    );
  });

  it("finds which ids are the owner's live simulations", async () => {
    const offer = await savedOffer();
    const [mine, gone] = await Promise.all([
      savedSimulation(offer),
      savedSimulation(offer),
    ]);
    const theirs = await savedSimulation(offer, otherOwnerId);
    await deleted(gone);

    const owned = await simulations.findIdsOwnedBy(ownerId, [
      mine.id,
      gone.id,
      theirs.id,
      generateUuid(),
    ]);

    expect(owned.value).toEqual([mine.id]);
    expect((await simulations.findIdsOwnedBy(ownerId, [])).value).toEqual([]);
  });

  it('reads the status, slots, and memberships of the owner plans', async () => {
    const offer = await savedOffer();
    const changingOffer = await savedOffer();
    const current = await savedSimulation(offer);
    await calculated(current, offer);
    const outdated = await savedSimulation(changingOffer);
    await calculated(outdated, changingOffer);
    const calculating = await savedSimulation(offer);
    const failing = await savedSimulation(offer);
    const failed = (await simulations.findById(failing.id)).value;
    expect(
      (
        await simulations.save(failed.markCalculationFailed(at('2026-10-02')))
      ).isOk(),
    ).toBe(true);
    const gone = await savedSimulation(offer);
    const edited = (await offers.findById(changingOffer.id)).value;
    edited.edit(
      {
        remunerationTerms: RemunerationTerms.create(
          'PREFIXED',
          Rate.of('0.13'),
        ),
      },
      at('2026-10-03'),
    );
    expect((await offers.save(edited)).isOk()).toBe(true);
    const memberIds = [current, outdated, calculating, failing, gone].map(
      ({ id }) => id,
    );
    const plan = await savedPlan('A status', memberIds);
    const other = await savedPlan('B sem membros');
    const removed = await savedPlan('C excluído', [current.id]);
    expect(
      (
        await plans.save((await load(removed.id)).delete(at('2026-10-04')))
      ).isOk(),
    ).toBe(true);
    await deleted(gone);

    const get = new GetInvestmentPlanQueryHandler(prisma);
    const detail = (await get.execute({ ownerId, investmentPlanId: plan.id }))
      .value;
    expect(detail).toEqual({
      id: plan.id,
      name: 'A status',
      description: null,
      revision: 1,
      simulationCount: 4,
      availableSimulationSlots: InvestmentPlan.SIMULATION_LIMIT - 4,
      status: {
        calculatingCount: 1,
        pendingIssueCount: 1,
        outdatedResultCount: 1,
        isSettled: false,
      },
    });
    expect(
      (await get.execute({ ownerId: otherOwnerId, investmentPlanId: plan.id }))
        .error.code,
    ).toBe(EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND);
    expect(
      (await get.execute({ ownerId, investmentPlanId: removed.id })).error.code,
    ).toBe(EAppErrorCode.INVESTMENT_PLAN_NOT_FOUND);

    const list = new ListInvestmentPlansQueryHandler(prisma);
    const all = (await list.execute({ ownerId, page: 1, pageSize: 100 })).value;
    const listed = all.items.filter(({ id }) =>
      [plan.id, other.id, removed.id].includes(id),
    );
    expect(listed).toEqual([
      {
        id: plan.id,
        name: 'A status',
        description: null,
        simulationCount: 4,
        status: detail.status,
      },
      {
        id: other.id,
        name: 'B sem membros',
        description: null,
        simulationCount: 0,
        status: {
          calculatingCount: 0,
          pendingIssueCount: 0,
          outdatedResultCount: 0,
          isSettled: true,
        },
      },
    ]);

    const ofCurrent = (
      await list.execute({
        ownerId,
        page: 1,
        pageSize: 100,
        simulationId: current.id,
      })
    ).value;
    expect(ofCurrent.items.map(({ id }) => id)).toEqual([plan.id]);
    expect(ofCurrent.total).toBe(1);
    expect(
      (
        await list.execute({
          ownerId,
          page: 1,
          pageSize: 100,
          simulationId: gone.id,
        })
      ).value.total,
    ).toBe(0);
  });

  it('lists only the live members of a live plan', async () => {
    const offer = await savedOffer();
    const [a, b, outside] = await Promise.all(
      [1, 2, 3].map(() => savedSimulation(offer)),
    );
    const plan = await savedPlan('Membros', [a.id, b.id]);
    await deleted(b);
    const list = new ListSimulationsQueryHandler(prisma);
    const members = async () =>
      (
        await list.execute({
          ownerId,
          page: 1,
          pageSize: 100,
          investmentPlanId: plan.id,
        })
      ).value;

    const live = await members();
    expect(live.items.map(({ id }) => id)).toEqual([a.id]);
    expect(live.total).toBe(1);
    expect(live.items.map(({ id }) => id)).not.toContain(outside.id);

    expect(
      (await plans.save((await load(plan.id)).delete(at('2026-10-27')))).isOk(),
    ).toBe(true);
    expect((await members()).total).toBe(0);
  });
});
