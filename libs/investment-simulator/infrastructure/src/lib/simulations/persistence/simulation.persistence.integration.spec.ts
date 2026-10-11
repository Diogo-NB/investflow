import { ConfigService } from '@nestjs/config';
import {
  EEconomicIndex,
  ETitleType,
  IndexCurve,
  IndexCurveInterval,
  IndexValue,
  InvestmentCalculator,
  InvestmentInputs,
  InvestmentTerms,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  Simulation,
  SimulationCalculation,
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
import { PrismaIndexCurveRepository } from '../../index-curves/persistence/prisma-index-curve.repository';
import { PrismaOfferRepository } from '../../offers/persistence/prisma-offer.repository';
import { GetSimulationWorkspaceQueryHandler } from '../../simulation-workspaces/queries/get-simulation-workspace.query-handler';
import { ListCalculationMonthlyBalancesQueryHandler } from '../queries/list-calculation-monthly-balances.query-handler';
import { ListSimulationsQueryHandler } from '../queries/list-simulations.query-handler';
import { PrismaSimulationCalculationRepository } from './prisma-simulation-calculation.repository';
import { PrismaSimulationRepository } from './prisma-simulation.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

// Run against a database with the migrations already applied.
const connectionString = process.env['INVESTMENT_SIMULATOR_TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

const calculator = new InvestmentCalculator(new BrazilianBusinessDayCalendar());

integration('Simulation PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let offers: PrismaOfferRepository;
  let curves: PrismaIndexCurveRepository;
  let simulations: PrismaSimulationRepository;
  let calculations: PrismaSimulationCalculationRepository;
  const issuerName = `Integration Simulation Bank ${generateUuid()}`;
  const ownerId = `owner-${generateUuid()}`;
  // Other tests leave simulations without calculations, which the app never
  // creates, so the list is read for an owner of its own.
  const historyOwnerId = `owner-${generateUuid()}`;
  const curveIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: connectionString }),
    );
    await prisma.onModuleInit();
    offers = new PrismaOfferRepository(prisma);
    curves = new PrismaIndexCurveRepository(prisma);
    simulations = new PrismaSimulationRepository(prisma);
    calculations = new PrismaSimulationCalculationRepository(prisma);
  });

  afterAll(async () => {
    try {
      const simulation = { ownerId: { in: [ownerId, historyOwnerId] } };
      await prisma.client.simulationCalculationBalance.deleteMany({
        where: { calculation: { simulation } },
      });
      await prisma.client.simulationCalculation.deleteMany({
        where: { simulation },
      });
      await prisma.client.simulation.deleteMany({ where: simulation });
      await prisma.client.investmentOffer.deleteMany({ where: { issuerName } });
      await prisma.client.indexCurveInterval.deleteMany({
        where: { curveId: { in: curveIds } },
      });
      await prisma.client.indexCurve.deleteMany({
        where: { id: { in: curveIds } },
      });
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  // A saved simulation of a CDI CDB over about one year of business days.
  async function savedSimulation(
    simulationOwner = ownerId,
    titleType = ETitleType.CDB,
  ) {
    const curve = IndexCurve.create({
      name: 'Integration simulation CDI',
      index: EEconomicIndex.CDI,
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
    const offer = Offer.create({
      titleType: ETitleType.CDB,
      issuerName,
      maturityDate: CalendarDate.of('2027-01-04'),
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms: RemunerationTerms.create(
        'CDI_PERCENTAGE',
        Rate.of('1.05'),
      ),
    });
    const terms = InvestmentTerms.create({
      titleType,
      issuerName,
      maturityDate: CalendarDate.of('2027-01-04'),
      redemption: RedemptionTerms.create('AT_MATURITY'),
      remuneration: RemunerationTerms.create('CDI_PERCENTAGE', Rate.of('1.05')),
    });
    const { simulation } = Simulation.start({
      ownerId: simulationOwner,
      sourceOfferId: offer.id,
      terms,
      investment: investmentOf(curve),
      indexCurve: curve,
      calculator,
      calculatedAt: UtcInstant.ofIso('2026-10-09T12:00:00.000Z'),
    }).value;
    for (const save of [
      () => curves.save(curve),
      () => offers.save(offer),
      () => simulations.save(simulation),
    ]) {
      expect((await save()).isOk()).toBe(true);
    }
    return { simulation, curve };
  }

  function investmentOf(curve: IndexCurve, principal = '10000.123456789') {
    return InvestmentInputs.create({
      principal: Money.of(principal),
      investmentDate: CalendarDate.of('2026-01-02'),
      indexCurveId: curve.id,
    });
  }

  // The simulations above are saved without their first calculation, which
  // the app never does; each test records the calculations it reads.
  function record(
    { simulation, curve }: Awaited<ReturnType<typeof savedSimulation>>,
    options: { calculatedAt?: string; principal?: string } = {},
  ) {
    return simulation.calculate({
      investment: investmentOf(curve, options.principal),
      indexCurve: curve,
      calculator,
      calculatedAt: UtcInstant.ofIso(
        options.calculatedAt ?? '2026-10-10T12:00:00.000Z',
      ),
    }).value;
  }

  it('restores a simulation only for its owner and while it is not deleted', async () => {
    const { simulation } = await savedSimulation();

    const loaded = (await simulations.findById(simulation.id, ownerId)).value;
    expect(loaded.sourceOfferId).toBe(simulation.sourceOfferId);
    expect(
      (await simulations.findById(simulation.id, 'someone-else')).error.code,
    ).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);

    simulation.delete(UtcInstant.ofIso('2026-10-13T00:00:00Z'));
    expect((await simulations.save(simulation)).isOk()).toBe(true);
    expect(
      (await simulations.findById(simulation.id, ownerId)).error.code,
    ).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
  });

  it('stores a full year of daily balances and restores them exactly', async () => {
    const saved = await savedSimulation();
    const calculation = record(saved);
    const { result } = calculation;
    expect(result.dailyBalances.length).toBeGreaterThan(240);

    expect((await calculations.save(calculation)).isOk()).toBe(true);
    const loaded = (await calculations.findById(calculation.id)).value;

    expect(loaded.simulationId).toBe(saved.simulation.id);
    expect(loaded.investment.equals(calculation.investment)).toBe(true);
    expect(loaded.result.methodologyVersion).toBe(result.methodologyVersion);
    expect(loaded.calculatedAt.equals(calculation.calculatedAt)).toBe(true);
    for (const key of Object.keys(
      result.maturitySummary,
    ) as (keyof typeof result.maturitySummary)[]) {
      expect(loaded.result.maturitySummary[key].amount.toFixed()).toBe(
        result.maturitySummary[key].amount.toFixed(),
      );
    }
    expect(loaded.result.dailyBalances).toHaveLength(
      result.dailyBalances.length,
    );
    loaded.result.dailyBalances.forEach((balance, index) => {
      const original = result.dailyBalances[index];
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

  it('stores an LCI income tax exemption as a null rate', async () => {
    const calculation = record(await savedSimulation(ownerId, ETitleType.LCI));
    expect(calculation.result.taxes.incomeTax.rate).toBeNull();

    expect((await calculations.save(calculation)).isOk()).toBe(true);
    const loaded = (await calculations.findById(calculation.id)).value;

    expect(loaded.result.methodologyVersion).toBe('lci-252-v1');
    expect(loaded.result.taxes.incomeTax.rate).toBeNull();
    expect(loaded.result.taxes.incomeTax.amount.isZero()).toBe(true);
    expect(loaded.result.maturitySummary.netBalance.amount.toFixed()).toBe(
      calculation.result.maturitySummary.grossBalance.amount.toFixed(),
    );
  });

  it('is append-only: saving a recorded calculation again fails without duplicating balances', async () => {
    const calculation = record(await savedSimulation());
    expect((await calculations.save(calculation)).isOk()).toBe(true);

    expect((await calculations.save(calculation)).isErr()).toBe(true);
    expect(
      await prisma.client.simulationCalculationBalance.count({
        where: { calculationId: calculation.id },
      }),
    ).toBe(calculation.result.dailyBalances.length);
  });

  it('writes a calculation and its balances atomically', async () => {
    const calculation = record(await savedSimulation());
    const duplicated = SimulationCalculation.reconstitute({
      id: calculation.id,
      simulationId: calculation.simulationId,
      investment: calculation.investment,
      result: {
        ...calculation.result,
        dailyBalances: [
          ...calculation.result.dailyBalances,
          calculation.result.dailyBalances[0],
        ],
      },
      calculatedAt: calculation.calculatedAt,
    });

    expect((await calculations.save(duplicated)).isErr()).toBe(true);
    expect(
      await prisma.client.simulationCalculation.findUnique({
        where: { id: calculation.id },
      }),
    ).toBeNull();
    expect(
      await prisma.client.simulationCalculationBalance.count({
        where: { calculationId: calculation.id },
      }),
    ).toBe(0);
  });

  it('reads the latest calculation as the current state and keeps the history', async () => {
    const saved = await savedSimulation(historyOwnerId);
    const first = record(saved, { calculatedAt: '2026-10-10T12:00:00.000Z' });
    const second = record(saved, {
      calculatedAt: '2026-10-11T12:00:00.000Z',
      principal: '20000',
    });
    for (const calculation of [first, second]) {
      expect((await calculations.save(calculation)).isOk()).toBe(true);
    }
    const workspace = new GetSimulationWorkspaceQueryHandler(prisma);
    const query = {
      ownerId: historyOwnerId,
      simulationId: saved.simulation.id,
    };

    const read = (await workspace.execute(query)).value;
    expect(read.simulation).toEqual({
      id: saved.simulation.id,
      fromCatalogOffer: true,
      terms: {
        titleType: 'CDB',
        issuerName,
        maturityDate: '2027-01-04',
        redemptionTerms: { kind: 'AT_MATURITY' },
        remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.05' },
      },
    });
    expect(read.calculations.map((item) => [item.id, item.outdated])).toEqual([
      [second.id, false],
      [first.id, false],
    ]);
    expect(read.calculations[0].investment).toEqual({
      principal: '20000',
      investmentDate: '2026-01-02',
      indexCurveId: saved.curve.id,
    });
    expect(read.calculations[1]).toMatchObject({
      investment: { principal: '10000.123456789' },
      businessDays: first.result.dailyBalances.length,
    });
    const listed = await new ListSimulationsQueryHandler(prisma).execute({
      ownerId: historyOwnerId,
      page: 1,
      pageSize: 100,
    });
    expect(
      listed.value.items.find((item) => item.id === saved.simulation.id),
    ).toMatchObject({
      fromCatalogOffer: true,
      issuerName,
      maturityDate: '2027-01-04',
      principal: '20000',
      latestCalculation: {
        id: second.id,
        calculatedAt: '2026-10-11T12:00:00.000Z',
        outdated: false,
        netBalance: second.result.maturitySummary.netBalance.amount.toFixed(),
      },
    });
    expect(
      (await workspace.execute({ ...query, ownerId: 'someone-else' })).error
        .code,
    ).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
  });

  it('keeps calculations readable after their curve is deleted and hides them with their simulation', async () => {
    const saved = await savedSimulation();
    const calculation = record(saved);
    const { result } = calculation;
    expect((await calculations.save(calculation)).isOk()).toBe(true);
    const get = new ListCalculationMonthlyBalancesQueryHandler(prisma);
    const query = { ownerId, calculationId: calculation.id };

    expect(
      (
        await curves.save(
          saved.curve.delete(UtcInstant.ofIso('2026-10-12T00:00:00Z')),
        )
      ).isOk(),
    ).toBe(true);
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
      result.dailyBalances.length,
    );
    for (const month of months) {
      expect(month.businessDays).toBe(month.days.length);
      expect(month.closingGrossBalance).toBe(month.days.at(-1)?.grossBalance);
    }
    const total = months.reduce(
      (sum, month) => sum.plus(month.monthGrossEarnings),
      new Prisma.Decimal(0),
    );
    expect(
      total.equals(result.maturitySummary.grossEarnings.amount.toFixed()),
    ).toBe(true);
    expect(months.at(-1)?.days.at(-1)?.date).toBe('2027-01-04');
    expect(
      (await get.execute({ ...query, ownerId: 'someone-else' })).error.code,
    ).toBe(EAppErrorCode.SIMULATION_CALCULATION_NOT_FOUND);

    expect(
      (
        await simulations.save(
          saved.simulation.delete(UtcInstant.ofIso('2026-10-13T00:00:00Z')),
        )
      ).isOk(),
    ).toBe(true);
    expect((await get.execute(query)).error.code).toBe(
      EAppErrorCode.SIMULATION_CALCULATION_NOT_FOUND,
    );
  });

  it('prevents removing a simulation that still has calculations', async () => {
    const saved = await savedSimulation();
    expect((await calculations.save(record(saved))).isOk()).toBe(true);

    await expect(
      prisma.client.simulation.delete({ where: { id: saved.simulation.id } }),
    ).rejects.toThrow();
  });
});
