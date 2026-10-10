import {
  ETitleType,
  InvestmentCalculator,
  InvestmentTerms,
  RedemptionTerms,
  RemunerationTerms,
  Simulation,
  SimulationCalculation,
  SimulationInputs,
} from '@investflow/investment-simulator-domain';
import {
  BrazilianBusinessDayCalendar,
  CalendarDate,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';
import { SimulationCalculationMapper } from './simulation-calculation.mapper';

function recordedCalculation(): SimulationCalculation {
  const inputs = SimulationInputs.create({
    terms: InvestmentTerms.create({
      titleType: ETitleType.CDB,
      issuerId: 'issuer-id',
      maturityDate: CalendarDate.of('2026-01-08'),
      redemption: RedemptionTerms.create('DAILY'),
      remuneration: RemunerationTerms.create('PREFIXED', Rate.of('0.12')),
    }),
    principal: Money.of('1000.123456789'),
    investmentDate: CalendarDate.of('2026-01-02'),
    indexCurveId: null,
  });
  const result = new InvestmentCalculator(
    new BrazilianBusinessDayCalendar(),
  ).calculate(inputs.toScenario(null).value).value;
  return SimulationCalculation.record({
    simulation: Simulation.create({ ownerId: 'owner-id', sourceOfferId: null }),
    inputs,
    result,
    calculatedAt: UtcInstant.ofIso('2026-10-10T12:00:00Z'),
  }).value;
}

// Mirrors what Prisma returns for the created row.
function storedRecord(calculation: SimulationCalculation) {
  const data = SimulationCalculationMapper.toPersistence(calculation);
  const decimal = (value: unknown) => new Prisma.Decimal(String(value));
  return {
    id: calculation.id,
    simulationId: calculation.simulationId,
    titleType: data.titleType,
    issuerId: calculation.inputs.terms.issuerId,
    maturityDate: data.maturityDate as Date,
    redemptionType: data.redemptionType,
    remunerationType: data.remunerationType,
    rateValue: decimal(data.rateValue),
    indexCurveId: calculation.inputs.indexCurveId,
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
    holdingPeriodCalendarDays: data.holdingPeriodCalendarDays,
    taxableEarnings: decimal(data.taxableEarnings),
    incomeTaxBase: decimal(data.incomeTaxBase),
    iofRate: data.iofRate == null ? null : decimal(data.iofRate),
    incomeTaxRate: decimal(data.incomeTaxRate),
    balances: (
      data.balances?.createMany
        ?.data as Prisma.SimulationCalculationBalanceCreateManyCalculationInput[]
    ).map((balance) => ({
      calculationId: calculation.id,
      date: balance.date as Date,
      grossBalance: decimal(balance.grossBalance),
      dailyGrossEarnings: decimal(balance.dailyGrossEarnings),
      accumulatedGrossEarnings: decimal(balance.accumulatedGrossEarnings),
    })),
  };
}

describe('SimulationCalculationMapper', () => {
  it('stores and restores every input, summary figure and daily balance', () => {
    const calculation = recordedCalculation();
    const data = SimulationCalculationMapper.toPersistence(calculation);

    expect(data.simulation).toEqual({
      connect: { id: calculation.simulationId },
    });
    expect(data.issuer).toEqual({ connect: { id: 'issuer-id' } });
    expect(data.indexCurve).toBeUndefined();
    const restored = SimulationCalculationMapper.toDomain(
      storedRecord(calculation),
    );

    expect(restored.id).toBe(calculation.id);
    expect(restored.inputs.equals(calculation.inputs)).toBe(true);
    expect(restored.calculatedAt.equals(calculation.calculatedAt)).toBe(true);
    const { result } = calculation;
    expect(restored.result.methodologyVersion).toBe(result.methodologyVersion);
    for (const key of Object.keys(
      result.maturitySummary,
    ) as (keyof typeof result.maturitySummary)[]) {
      expect(
        restored.result.maturitySummary[key].equals(result.maturitySummary[key]),
      ).toBe(true);
    }
    const taxation = restored.result.taxation;
    expect(taxation.holdingPeriodCalendarDays).toBe(
      result.taxation.holdingPeriodCalendarDays,
    );
    expect(taxation.taxableEarnings.equals(result.taxation.taxableEarnings)).toBe(
      true,
    );
    expect(taxation.incomeTaxBase.equals(result.taxation.incomeTaxBase)).toBe(
      true,
    );
    expect(taxation.iofRate?.value.toFixed()).toBe(
      result.taxation.iofRate?.value.toFixed(),
    );
    expect(taxation.incomeTaxRate.equals(result.taxation.incomeTaxRate)).toBe(
      true,
    );
    expect(restored.result.dailyBalances).toHaveLength(
      result.dailyBalances.length,
    );
    restored.result.dailyBalances.forEach((balance, index) => {
      const original = result.dailyBalances[index];
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
