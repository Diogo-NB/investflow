import {
  CalculateSimulationCommand,
  CalculateSimulationUseCase,
  RecalculateCurveSimulationsUseCase,
  RecalculateOfferSimulationsUseCase,
} from '@investflow/investment-simulator-application';
import {
  Curve,
  CurveInterval,
  EEconomicIndex,
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
  ETitleType,
  IndexValue,
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
  CalendarDateRange,
  generateUuid,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  EExperimentEventContent,
  PrismaService,
  TransactionalDomainEventRecorder,
  UnitOfWork,
} from '@investflow/shared-infrastructure';
import { PrismaSimulationRepository } from '../../../simulations/persistence/prisma-simulation.repository';
import { ContentCarryingCurveRepository } from '../content-carrying-curve.repository';
import { ContentCarryingOfferRepository } from '../content-carrying-offer.repository';
import { CurveCopyRepository } from '../curve-copy.repository';
import { OfferCopyRepository } from '../offer-copy.repository';
import type { ContentCarryingEventContent } from '../premise-content.events';
import { PremiseCopyRecalculationConsumer } from '../premise-copy-recalculation.consumer';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const connectionString = process.env['INTEGRATION_TEST_DATABASE_URL'];
if (!connectionString) {
  throw new Error(
    'INTEGRATION_TEST_DATABASE_URL is not set; run pnpm check:integration',
  );
}

// A login that can read and write every table but the producer's: what the
// V2 and V3 calculation would be left with in a service of its own.
const RESTRICTED_ROLE = 'premise_copy_reader';
const RESTRICTED_PASSWORD = 'premise-copy-reader';
const PRODUCER_TABLES = ['offer', 'curve', 'curve_interval'];

function restrictedConnectionString(): string {
  const url = new URL(connectionString!);
  url.username = RESTRICTED_ROLE;
  url.password = RESTRICTED_PASSWORD;
  return url.toString();
}

const clock: Clock = {
  now: () => UtcInstant.ofIso('2026-10-11T12:00:00Z'),
  today: () => CalendarDate.of('2026-10-11'),
};
const at = UtcInstant.ofIso('2026-10-09T12:00:00Z');

describe.each<ContentCarryingEventContent>([
  EExperimentEventContent.DELTA,
  EExperimentEventContent.STATE,
])('V2 and V3 calculation from the copy (%s)', (content) => {
  const events = new TransactionalDomainEventRecorder(clock);
  const ownerId = `owner-${generateUuid()}`;
  const offerIds: string[] = [];
  const curveIds: string[] = [];
  let producerDatabase: PrismaService;
  let producerUnitOfWork: UnitOfWork;
  let copyDatabase: PrismaService;
  let copyUnitOfWork: UnitOfWork;
  let offers: ContentCarryingOfferRepository;
  let curves: ContentCarryingCurveRepository;
  let offerCopies: OfferCopyRepository;
  let consumer: PremiseCopyRecalculationConsumer;
  let worker: CalculateSimulationUseCase;

  beforeAll(async () => {
    producerDatabase = new PrismaService({ url: connectionString! });
    await producerDatabase.onModuleInit();
    producerUnitOfWork = new UnitOfWork(producerDatabase);
    await producerDatabase.client.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${RESTRICTED_ROLE}') THEN
          CREATE ROLE ${RESTRICTED_ROLE} LOGIN PASSWORD '${RESTRICTED_PASSWORD}';
        END IF;
      END $$`);
    await producerDatabase.client.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA public TO ${RESTRICTED_ROLE}`,
    );
    await producerDatabase.client.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RESTRICTED_ROLE}`,
    );
    await producerDatabase.client.$executeRawUnsafe(
      `REVOKE ALL ON ${PRODUCER_TABLES.join(', ')} FROM ${RESTRICTED_ROLE}`,
    );

    copyDatabase = new PrismaService({ url: restrictedConnectionString() });
    await copyDatabase.onModuleInit();
    copyUnitOfWork = new UnitOfWork(copyDatabase);

    offers = new ContentCarryingOfferRepository(
      producerDatabase,
      events,
      content,
    );
    curves = new ContentCarryingCurveRepository(
      producerDatabase,
      events,
      content,
    );
    const simulations = new PrismaSimulationRepository(copyDatabase, events);
    offerCopies = new OfferCopyRepository(copyDatabase, true);
    const curveCopies = new CurveCopyRepository(copyDatabase, true);
    consumer = new PremiseCopyRecalculationConsumer(
      offerCopies,
      curveCopies,
      new RecalculateOfferSimulationsUseCase(simulations, events, clock),
      new RecalculateCurveSimulationsUseCase(simulations, events, clock),
    );
    worker = new CalculateSimulationUseCase(
      simulations,
      offerCopies,
      curveCopies,
      new SimulationCalculationService(new InvestmentCalculator()),
      clock,
    );
  });

  afterAll(async () => {
    try {
      const client = producerDatabase.client;
      const simulation = { ownerId };
      const simulationIds = (
        await client.simulation.findMany({
          where: simulation,
          select: { id: true },
        })
      ).map(({ id }) => id);
      await client.simulationCalculation.deleteMany({ where: { simulation } });
      await client.simulationResultBalance.deleteMany({
        where: { result: { simulation } },
      });
      await client.simulationResult.deleteMany({ where: { simulation } });
      await client.simulation.deleteMany({ where: simulation });
      await client.offerCopy.deleteMany({
        where: { offerId: { in: offerIds } },
      });
      await client.curveCopy.deleteMany({
        where: { curveId: { in: curveIds } },
      });
      await client.offer.deleteMany({ where: { id: { in: offerIds } } });
      await client.curveInterval.deleteMany({
        where: { curveId: { in: curveIds } },
      });
      await client.curve.deleteMany({ where: { id: { in: curveIds } } });
      await client.outboxEvent.deleteMany({
        where: {
          aggregateId: { in: [...offerIds, ...curveIds, ...simulationIds] },
        },
      });
    } finally {
      await copyDatabase.onApplicationShutdown();
      await producerDatabase.onApplicationShutdown();
    }
  });

  // The payload the queue would deliver: what the outbox stored.
  async function lastPayload(
    aggregateId: string,
    eventType: string,
  ): Promise<Record<string, unknown>> {
    const row = await producerDatabase.client.outboxEvent.findFirstOrThrow({
      where: { aggregateId, eventType },
      orderBy: { createdAt: 'desc' },
    });
    return row.payload as Record<string, unknown>;
  }

  function producerSave(save: () => Promise<{ isOk(): boolean }>) {
    return producerUnitOfWork.run(async () => {
      expect((await save()).isOk()).toBe(true);
    });
  }

  async function premises() {
    const curve = Curve.create(
      {
        ownerId: null,
        index: EEconomicIndex.CDI,
        name: 'Premise copy CDI',
        intervals: [
          CurveInterval.create(
            CalendarDateRange.of(
              CalendarDate.of('2026-01-01'),
              CalendarDate.of('2027-12-31'),
            ),
            IndexValue.of('0.1415'),
          ),
        ],
      },
      at,
    ).value;
    const offer = Offer.create(
      {
        ownerId: null,
        titleType: ETitleType.CDB,
        name: 'Premise copy 105% do CDI',
        maturityDate: CalendarDate.of('2027-01-04'),
        redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
        remunerationTerms: RemunerationTerms.create(
          'CDI_PERCENTAGE',
          Rate.of('1.05'),
        ),
      },
      at,
    );
    curveIds.push(curve.id);
    offerIds.push(offer.id);
    await producerSave(() => curves.save(curve));
    await producerSave(() => offers.save(offer));
    const simulation = Simulation.create(
      {
        ownerId,
        offerId: offer.id,
        investment: InvestmentInputs.create({
          principal: Money.of('10000'),
          investmentDate: CalendarDate.of('2026-01-02'),
          curveId: curve.id,
        }),
      },
      { kind: ESimulationCalculationCauseKind.CREATED, actorId: ownerId },
      at,
    );
    await producerSave(() =>
      new PrismaSimulationRepository(producerDatabase, events).save(simulation),
    );
    return { offer, curve, simulation };
  }

  function consume(handle: () => Promise<void>): Promise<void> {
    return copyUnitOfWork.run(handle);
  }

  async function calculate(simulationId: string) {
    const result = await copyUnitOfWork.run(() =>
      worker.execute(CalculateSimulationCommand.of(simulationId)),
    );
    return result;
  }

  async function storedOutcome(simulationId: string) {
    return producerDatabase.client.simulation.findUniqueOrThrow({
      where: { id: simulationId },
      select: { calculation: true, result: true },
    });
  }

  it('cannot read the producer tables', async () => {
    await expect(copyDatabase.client.offer.findFirst()).rejects.toThrow(
      /permission denied/,
    );
    await expect(copyDatabase.client.curveInterval.findFirst()).rejects.toThrow(
      /permission denied/,
    );
  });

  it('retries a calculation until the copy has its offer and curve', async () => {
    const { simulation } = await premises();

    const result = await calculate(simulation.id);

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
    expect((await storedOutcome(simulation.id)).calculation?.status).toBe(
      ESimulationCalculationStatus.PENDING,
    );
  });

  it('calculates from the copy and follows a change of the terms', async () => {
    const { offer, curve, simulation } = await premises();
    await consume(async () => {
      await consumer.onCurveCreated(
        await lastPayload(curve.id, 'CurveCreated'),
      );
      await consumer.onOfferCreated(
        await lastPayload(offer.id, 'OfferCreated'),
      );
    });
    expect((await calculate(simulation.id)).isOk()).toBe(true);
    const first = await storedOutcome(simulation.id);
    expect(first.calculation?.status).toBe(
      ESimulationCalculationStatus.CALCULATED,
    );

    const edited = (await offers.findById(offer.id)).value;
    edited.edit({ maturityDate: CalendarDate.of('2027-06-30') }, at);
    await producerSave(() => offers.save(edited));
    const termsChanged = await lastPayload(offer.id, 'OfferTermsChanged');
    // JSONB does not keep key order.
    expect(Object.keys(termsChanged['offer'] as object).sort()).toEqual(
      content === EExperimentEventContent.DELTA
        ? ['maturityDate']
        : [
            'isDeleted',
            'maturityDate',
            'redemptionKind',
            'remuneration',
            'titleType',
          ],
    );
    await consume(() => consumer.onOfferTermsChanged(termsChanged));
    const requested = await producerDatabase.client.outboxEvent.count({
      where: {
        aggregateId: simulation.id,
        eventType: 'SimulationCalculationRequested',
      },
    });
    expect(requested).toBe(1);

    expect((await calculate(simulation.id)).isOk()).toBe(true);
    const second = await storedOutcome(simulation.id);
    const reference = new SimulationCalculationService(
      new InvestmentCalculator(),
    ).calculate(
      (
        await new PrismaSimulationRepository(producerDatabase, events).findById(
          simulation.id,
        )
      ).value,
      edited,
      curve,
      clock.now(),
    );
    expect(reference.kind).toBe('CALCULATED');
    expect(second.result?.maturityDate.toISOString()).toBe(
      '2027-06-30T00:00:00.000Z',
    );
    expect(second.result?.netBalance.toFixed()).toBe(
      reference.kind === 'CALCULATED'
        ? reference.result.projection.net.finalBalance.amount
            .toDecimalPlaces(30)
            .toFixed()
        : null,
    );
    expect(second.result?.inputFingerprint).toBe(
      reference.kind === 'CALCULATED'
        ? reference.result.inputFingerprint.toString()
        : null,
    );
  });

  it('drops an event older than the copy', async () => {
    const { offer } = await premises();
    const created = await lastPayload(offer.id, 'OfferCreated');
    await consume(() => consumer.onOfferCreated(created));
    const edited = (await offers.findById(offer.id)).value;
    edited.edit({ maturityDate: CalendarDate.of('2027-06-30') }, at);
    await producerSave(() => offers.save(edited));
    await consume(async () =>
      consumer.onOfferTermsChanged(
        await lastPayload(offer.id, 'OfferTermsChanged'),
      ),
    );

    await consume(() => consumer.onOfferCreated(created));

    const copy = await producerDatabase.client.offerCopy.findUniqueOrThrow({
      where: { offerId: offer.id },
    });
    expect(copy.revision).toBe(2);
    expect(copy.maturityDate.toISOString()).toBe('2027-06-30T00:00:00.000Z');
  });
});
