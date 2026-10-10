import { ConfigService } from '@nestjs/config';
import {
  Application,
  EconomicIndex,
  IndexCurve,
  IndexCurveInterval,
  IndexValue,
  InvestmentCalculator,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  SimulationRun,
  TitleType,
} from '@investflow/investment-simulator-domain';
import {
  BrazilianBusinessDayCalendar,
  CalendarDate,
  CalendarDateRange,
  generateUuid,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { PrismaApplicationRepository } from '../../applications/persistence/prisma-application.repository';
import { PrismaIndexCurveRepository } from '../../index-curves/persistence/prisma-index-curve.repository';
import { PrismaOfferRepository } from '../../offers/persistence/prisma-offer.repository';
import { GetSimulationRunQueryHandler } from '../queries/get-simulation-run.query-handler';
import { ListApplicationRunsQueryHandler } from '../queries/list-application-runs.query-handler';
import { PrismaSimulationRunRepository } from './prisma-simulation-run.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

// Run against a database with the migrations already applied.
const connectionString = process.env['INVESTMENT_SIMULATOR_TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

const calculator = new InvestmentCalculator(new BrazilianBusinessDayCalendar());

integration('Simulation run PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let offers: PrismaOfferRepository;
  let curves: PrismaIndexCurveRepository;
  let applications: PrismaApplicationRepository;
  let runs: PrismaSimulationRunRepository;
  const issuerId = generateUuid();
  const ownerId = `owner-${generateUuid()}`;
  const curveIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: connectionString }),
    );
    await prisma.onModuleInit();
    offers = new PrismaOfferRepository(prisma);
    curves = new PrismaIndexCurveRepository(prisma);
    applications = new PrismaApplicationRepository(prisma);
    runs = new PrismaSimulationRunRepository(prisma);
    await prisma.client.investmentIssuer.create({
      data: { id: issuerId, name: 'Integration Run Bank' },
    });
  });

  afterAll(async () => {
    try {
      const runIds = (
        await prisma.client.simulationRun.findMany({
          where: { ownerId },
          select: { id: true },
        })
      ).map(({ id }) => id);
      await prisma.client.simulationRunBalance.deleteMany({
        where: { runId: { in: runIds } },
      });
      await prisma.client.simulationRun.deleteMany({ where: { ownerId } });
      await prisma.client.investmentApplication.deleteMany({
        where: { ownerId },
      });
      await prisma.client.investmentOffer.deleteMany({
        where: { issuerId, sourceOfferId: { not: null } },
      });
      await prisma.client.investmentOffer.deleteMany({ where: { issuerId } });
      await prisma.client.indexCurveInterval.deleteMany({
        where: { curveId: { in: curveIds } },
      });
      await prisma.client.indexCurve.deleteMany({
        where: { id: { in: curveIds } },
      });
      await prisma.client.investmentIssuer.delete({ where: { id: issuerId } });
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  // A saved CDI application over about one year of business days.
  async function savedApplication() {
    const curve = IndexCurve.create({
      name: 'Integration run CDI',
      index: EconomicIndex.CDI,
      intervals: [
        IndexCurveInterval.create(
          CalendarDateRange.of(
            CalendarDate.of('2026-01-01'),
            CalendarDate.of('2026-12-31'),
          ),
          IndexValue.of('0.1415'),
        ),
      ],
    }).value;
    curveIds.push(curve.id);
    const catalog = Offer.create({
      titleType: TitleType.CDB,
      issuerId,
      maturityDate: CalendarDate.of('2027-01-04'),
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms: RemunerationTerms.create(
        'CDI_PERCENTAGE',
        Rate.of('1.05'),
      ),
    });
    const snapshot = catalog.createSnapshot().value;
    const application = Application.create({
      ownerId,
      offerSnapshot: snapshot,
      indexCurve: curve,
      principal: Money.of('10000.123456789'),
      investmentDate: CalendarDate.of('2026-01-02'),
    }).value;
    for (const save of [
      () => curves.save(curve),
      () => offers.save(catalog),
      () => offers.save(snapshot),
      () => applications.save(application),
    ]) {
      expect((await save()).isOk()).toBe(true);
    }
    return { application, snapshot, curve };
  }

  function record(
    {
      application,
      snapshot,
      curve,
    }: Awaited<ReturnType<typeof savedApplication>>,
    calculatedAt = '2026-10-10T12:00:00.000Z',
  ) {
    const calculation = calculator.calculate(
      application.toScenario(snapshot, curve).value,
    ).value;
    return SimulationRun.record({
      application,
      calculation,
      calculatedAt: UtcInstant.ofIso(calculatedAt),
    });
  }

  it('stores a full year of daily balances and restores them exactly', async () => {
    const saved = await savedApplication();
    const run = record(saved);
    expect(run.dailyBalances.length).toBeGreaterThan(240);

    expect((await runs.save(run)).isOk()).toBe(true);
    const loaded = (await runs.findById(run.id)).value;

    expect(loaded.applicationId).toBe(saved.application.id);
    expect(loaded.indexCurveId).toBe(saved.curve.id);
    expect(loaded.principal.equals(run.principal)).toBe(true);
    expect(loaded.methodologyVersion).toBe(run.methodologyVersion);
    expect(loaded.calculatedAt.equals(run.calculatedAt)).toBe(true);
    for (const key of Object.keys(
      run.maturitySummary,
    ) as (keyof SimulationRun['maturitySummary'])[]) {
      expect(loaded.maturitySummary[key].amount.toFixed()).toBe(
        run.maturitySummary[key].amount.toFixed(),
      );
    }
    expect(loaded.dailyBalances).toHaveLength(run.dailyBalances.length);
    loaded.dailyBalances.forEach((balance, index) => {
      const original = run.dailyBalances[index];
      expect(balance.date.toIsoString()).toBe(original.date.toIsoString());
      expect(balance.grossBalance.amount.toFixed()).toBe(
        original.grossBalance.amount.toFixed(),
      );
      expect(balance.dailyGrossEarnings.amount.toFixed()).toBe(
        original.dailyGrossEarnings.amount.toFixed(),
      );
      expect(balance.accumulatedGrossEarnings.amount.toFixed()).toBe(
        original.accumulatedGrossEarnings.amount.toFixed(),
      );
    });
  });

  it('is append-only: saving a recorded run again fails without duplicating balances', async () => {
    const run = record(await savedApplication());
    expect((await runs.save(run)).isOk()).toBe(true);

    expect((await runs.save(run)).isErr()).toBe(true);
    expect(
      await prisma.client.simulationRunBalance.count({
        where: { runId: run.id },
      }),
    ).toBe(run.dailyBalances.length);
  });

  it('writes a run and its balances atomically', async () => {
    const run = record(await savedApplication());
    const duplicated = SimulationRun.reconstitute({
      id: run.id,
      ownerId: run.ownerId,
      applicationId: run.applicationId,
      offerSnapshotId: run.offerSnapshotId,
      indexCurveId: run.indexCurveId,
      principal: run.principal,
      investmentDate: run.investmentDate,
      methodologyVersion: run.methodologyVersion,
      calculatedAt: run.calculatedAt,
      maturitySummary: run.maturitySummary,
      dailyBalances: [...run.dailyBalances, run.dailyBalances[0]],
    });

    expect((await runs.save(duplicated)).isErr()).toBe(true);
    expect(
      await prisma.client.simulationRun.findUnique({ where: { id: run.id } }),
    ).toBeNull();
    expect(
      await prisma.client.simulationRunBalance.count({
        where: { runId: run.id },
      }),
    ).toBe(0);
  });

  it('lists runs newest first and flags runs the application has moved past', async () => {
    const saved = await savedApplication();
    const first = record(saved, '2026-10-10T12:00:00.000Z');
    expect((await runs.save(first)).isOk()).toBe(true);
    const list = new ListApplicationRunsQueryHandler(prisma);
    const query = { ownerId, applicationId: saved.application.id };

    const fresh = await list.execute(query);
    expect(fresh.value.items.map((item) => [item.id, item.outdated])).toEqual([
      [first.id, false],
    ]);

    saved.application.revise({
      offerSnapshot: saved.snapshot,
      indexCurve: saved.curve,
      principal: Money.of('20000'),
      investmentDate: saved.application.investmentDate,
    });
    expect((await applications.save(saved.application)).isOk()).toBe(true);
    const second = record(saved, '2026-10-11T12:00:00.000Z');
    expect((await runs.save(second)).isOk()).toBe(true);

    const history = await list.execute(query);
    expect(history.value.items.map((item) => [item.id, item.outdated])).toEqual(
      [
        [second.id, false],
        [first.id, true],
      ],
    );
    expect(history.value.items[1].inputs.principal).toBe('10000.123456789');
    expect(
      (await list.execute({ ...query, ownerId: 'someone-else' })).error.code,
    ).toBe('APPLICATION_NOT_FOUND');
  });

  it('keeps runs readable after their curve is deleted and hides them with their application', async () => {
    const saved = await savedApplication();
    const run = record(saved);
    expect((await runs.save(run)).isOk()).toBe(true);
    const get = new GetSimulationRunQueryHandler(prisma);
    const query = { ownerId, runId: run.id };

    expect(
      (
        await curves.save(
          saved.curve.delete(UtcInstant.ofIso('2026-10-12T00:00:00Z')),
        )
      ).isOk(),
    ).toBe(true);
    const detail = await get.execute(query);
    expect(detail.value.applicationId).toBe(saved.application.id);
    expect(detail.value.inputs.indexCurveId).toBe(saved.curve.id);
    expect(detail.value.dailyBalances).toHaveLength(run.dailyBalances.length);
    expect(detail.value.dailyBalances.at(-1)?.date).toBe('2027-01-04');
    expect(detail.value.maturitySummary.grossBalance).toBe(
      run.maturitySummary.grossBalance.amount.toFixed(),
    );
    expect(
      (await get.execute({ ...query, ownerId: 'someone-else' })).error.code,
    ).toBe('SIMULATION_RUN_NOT_FOUND');

    expect(
      (
        await applications.save(
          saved.application.delete(UtcInstant.ofIso('2026-10-13T00:00:00Z')),
        )
      ).isOk(),
    ).toBe(true);
    expect((await get.execute(query)).error.code).toBe(
      'SIMULATION_RUN_NOT_FOUND',
    );
  });

  it('prevents removing an application that still has recorded runs', async () => {
    const saved = await savedApplication();
    expect((await runs.save(record(saved))).isOk()).toBe(true);

    await expect(
      prisma.client.investmentApplication.delete({
        where: { id: saved.application.id },
      }),
    ).rejects.toThrow();
  });
});
