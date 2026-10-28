import { ConfigService } from '@nestjs/config';
import { BuildSimulationComparisonUseCase } from '@investflow/investment-simulator-application';
import {
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
  ETitleType,
  InvestmentCalculator,
  InvestmentInputs,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  Simulation,
  SimulationCalculationService,
} from '@investflow/investment-simulator-domain';
import { Clock } from '@investflow/shared-application';
import {
  CalendarDate,
  EAppErrorCode,
  generateUuid,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  PrismaService,
  TransactionalDomainEventRecorder,
  UnitOfWork,
} from '@investflow/shared-infrastructure';
import Decimal from 'decimal.js';
import { PrismaOfferRepository } from '../../offers/persistence/prisma-offer.repository';
import { PrismaSimulationRepository } from '../../simulations/persistence/prisma-simulation.repository';
import { GetSimulationComparisonQueryHandler } from '../queries/get-simulation-comparison.query-handler';
import { PrismaComparedSimulationReader } from './prisma-compared-simulation-reader';

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

describe('Compared simulations PostgreSQL read', () => {
  let prisma: PrismaService;
  const clock: Clock = {
    now: () => UtcInstant.ofIso('2026-10-28T12:00:00Z'),
    today: () => CalendarDate.of('2026-10-28'),
  };
  const events = new TransactionalDomainEventRecorder(clock);
  let offers: PrismaOfferRepository;
  let simulations: PrismaSimulationRepository;
  const issuerName = `Integration Comparison Bank ${generateUuid()}`;
  const ownerId = `owner-${generateUuid()}`;
  const otherOwnerId = `owner-${generateUuid()}`;

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: connectionString }),
    );
    const unitOfWork = new UnitOfWork(prisma);
    await prisma.onModuleInit();
    offers = inUnitOfWork(
      unitOfWork,
      new PrismaOfferRepository(prisma, events),
    );
    simulations = inUnitOfWork(
      unitOfWork,
      new PrismaSimulationRepository(prisma, events),
    );
  });

  afterAll(async () => {
    try {
      const simulation = { ownerId: { in: [ownerId, otherOwnerId] } };
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
          principal: Money.of('10000.01'),
          investmentDate: CalendarDate.of('2026-01-02'),
          curveId: null,
        }),
      },
      { kind: ESimulationCalculationCauseKind.CREATED, actorId: owner },
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

  // The handler as the module composes it.
  const comparisonHandler = () =>
    new GetSimulationComparisonQueryHandler(
      prisma,
      clock,
      new BuildSimulationComparisonUseCase(
        new PrismaComparedSimulationReader(prisma),
      ),
    );

  it("reads the owner's live simulations to the exact decimal", async () => {
    const offer = await savedOffer();
    const [kept, waiting, gone, theirs] = await Promise.all([
      savedSimulation(offer),
      savedSimulation(offer),
      savedSimulation(offer),
      savedSimulation(offer, otherOwnerId),
    ]);
    await calculated(kept, offer);
    const loaded = (await simulations.findById(gone.id)).value;
    expect(
      (await simulations.save(loaded.delete(at('2026-10-03')))).isOk(),
    ).toBe(true);
    const row = await prisma.client.simulationResult.findUniqueOrThrow({
      where: { simulationId: kept.id },
    });

    const found = (
      await new PrismaComparedSimulationReader(prisma).findOwned(ownerId, [
        kept.id,
        waiting.id,
        gone.id,
        theirs.id,
        generateUuid(),
      ])
    ).value;

    expect(new Set(found.keys())).toEqual(new Set([kept.id, waiting.id]));
    const compared = found.get(kept.id);
    expect(compared?.isSettled).toBe(true);
    expect(compared?.lastResult?.principal.amount.toFixed()).toBe('10000.01');
    expect(compared?.lastResult?.netFinalBalance.amount.toFixed()).toBe(
      row.netBalance.toFixed(),
    );
    expect(compared?.lastResult?.netAnnualReturn).toEqual(
      new Decimal(row.netAnnualReturn.toFixed()),
    );
    expect(compared?.lastResult?.investmentDate.toIsoString()).toBe(
      '2026-01-02',
    );
    expect(compared?.lastResult?.maturityDate.toIsoString()).toBe('2027-01-04');
    expect(found.get(waiting.id)).toMatchObject({
      calculationStatus: ESimulationCalculationStatus.PENDING,
      lastResult: null,
      isSettled: false,
    });
  });

  it('ranks a stale result without settling the comparison', async () => {
    const changing = await savedOffer('0.15');
    const steady = await savedOffer('0.12');
    const stale = await savedSimulation(changing);
    const current = await savedSimulation(steady);
    await calculated(stale, changing);
    await calculated(current, steady);
    const edited = (await offers.findById(changing.id)).value;
    edited.edit(
      {
        remunerationTerms: RemunerationTerms.create(
          'PREFIXED',
          Rate.of('0.11'),
        ),
      },
      at('2026-10-03'),
    );
    expect((await offers.save(edited)).isOk()).toBe(true);

    const comparison = (
      await comparisonHandler().execute({
        ownerId,
        ids: [current.id, stale.id],
      })
    ).value;

    expect(comparison).toMatchObject({
      isSettled: false,
      areAmountsComparable: true,
      simulations: [
        {
          simulation: { id: current.id },
          isSettled: true,
          standing: { position: 2, isLeader: false },
        },
        {
          simulation: { id: stale.id },
          isSettled: false,
          result: { outdated: true },
          standing: { position: 1, isLeader: true, netAnnualReturnGap: '0' },
        },
      ],
    });
  });

  it("answers not found for another owner's simulation", async () => {
    const offer = await savedOffer();
    const [mine, theirs] = await Promise.all([
      savedSimulation(offer),
      savedSimulation(offer, otherOwnerId),
    ]);

    const result = await comparisonHandler().execute({
      ownerId,
      ids: [mine.id, theirs.id],
    });

    expect(result.error).toMatchObject({
      code: EAppErrorCode.SIMULATION_NOT_FOUND,
      metadata: { simulationId: theirs.id },
    });
  });
});
