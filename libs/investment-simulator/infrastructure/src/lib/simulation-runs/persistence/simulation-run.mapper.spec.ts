import {
  Application,
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
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';
import { SimulationRunMapper } from './simulation-run.mapper';

function recordedRun(): SimulationRun {
  const offerSnapshot = Offer.create({
    titleType: TitleType.CDB,
    issuerId: 'issuer-id',
    maturityDate: CalendarDate.of('2026-01-08'),
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('0.12')),
  }).createSnapshot().value;
  const application = Application.create({
    ownerId: 'owner-id',
    offerSnapshot,
    indexCurve: null,
    principal: Money.of('1000.123456789'),
    investmentDate: CalendarDate.of('2026-01-02'),
  }).value;
  const calculation = new InvestmentCalculator(
    new BrazilianBusinessDayCalendar(),
  ).calculate(application.toScenario(offerSnapshot, null).value).value;
  return SimulationRun.record({
    application,
    calculation,
    calculatedAt: UtcInstant.ofIso('2026-10-10T12:00:00Z'),
  });
}

// Mirrors what Prisma returns for the created row.
function storedRecord(run: SimulationRun) {
  const data = SimulationRunMapper.toPersistence(run);
  const decimal = (value: unknown) => new Prisma.Decimal(String(value));
  return {
    id: run.id,
    ownerId: data.ownerId,
    applicationId: run.applicationId,
    offerSnapshotId: run.offerSnapshotId,
    indexCurveId: run.indexCurveId,
    principal: decimal(data.principal),
    investmentDate: data.investmentDate as Date,
    methodologyVersion: data.methodologyVersion,
    calculatedAt: data.calculatedAt as Date,
    grossBalance: decimal(data.grossBalance),
    grossEarnings: decimal(data.grossEarnings),
    iof: decimal(data.iof),
    incomeTax: decimal(data.incomeTax),
    totalTaxes: decimal(data.totalTaxes),
    netBalance: decimal(data.netBalance),
    balances: (
      data.balances?.createMany
        ?.data as Prisma.SimulationRunBalanceCreateManyRunInput[]
    ).map((balance) => ({
      runId: run.id,
      date: balance.date as Date,
      grossBalance: decimal(balance.grossBalance),
      dailyGrossEarnings: decimal(balance.dailyGrossEarnings),
      accumulatedGrossEarnings: decimal(balance.accumulatedGrossEarnings),
    })),
  };
}

describe('SimulationRunMapper', () => {
  it('stores and restores every input, summary figure and daily balance', () => {
    const run = recordedRun();
    const data = SimulationRunMapper.toPersistence(run);

    expect(data.application).toEqual({ connect: { id: run.applicationId } });
    expect(data.indexCurve).toBeUndefined();
    const restored = SimulationRunMapper.toDomain(storedRecord(run));

    expect(restored.id).toBe(run.id);
    expect(restored.principal.equals(run.principal)).toBe(true);
    expect(restored.investmentDate.equals(run.investmentDate)).toBe(true);
    expect(restored.methodologyVersion).toBe(run.methodologyVersion);
    expect(restored.calculatedAt.equals(run.calculatedAt)).toBe(true);
    for (const key of Object.keys(
      run.maturitySummary,
    ) as (keyof SimulationRun['maturitySummary'])[]) {
      expect(
        restored.maturitySummary[key].equals(run.maturitySummary[key]),
      ).toBe(true);
    }
    expect(restored.dailyBalances).toHaveLength(run.dailyBalances.length);
    restored.dailyBalances.forEach((balance, index) => {
      const original = run.dailyBalances[index];
      expect(balance.date.equals(original.date)).toBe(true);
      expect(balance.grossBalance.equals(original.grossBalance)).toBe(true);
      expect(
        balance.accumulatedGrossEarnings.equals(
          original.accumulatedGrossEarnings,
        ),
      ).toBe(true);
    });
  });
});
