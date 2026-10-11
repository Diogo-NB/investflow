import {
  ETitleType,
  InvestmentCalculator,
  InvestmentInputs,
  InvestmentTerms,
  RedemptionTerms,
  RemunerationTerms,
  Simulation,
  SimulationCalculation,
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

function recordedCalculation(
  titleType = ETitleType.CDB,
  maturityDate = '2026-01-08',
): SimulationCalculation {
  return Simulation.start({
    ownerId: 'owner-id',
    sourceOfferId: null,
    terms: InvestmentTerms.create({
      titleType,
      issuerName: null,
      maturityDate: CalendarDate.of(maturityDate),
      redemption: RedemptionTerms.create('DAILY'),
      remuneration: RemunerationTerms.create('PREFIXED', Rate.of('0.12')),
    }),
    investment: InvestmentInputs.create({
      principal: Money.of('1000.123456789'),
      investmentDate: CalendarDate.of('2026-01-02'),
      curveId: null,
    }),
    curve: null,
    calculator: new InvestmentCalculator(new BrazilianBusinessDayCalendar()),
    calculatedAt: UtcInstant.ofIso('2026-10-10T12:00:00Z'),
  }).value.calculation;
}

// Mirrors what Prisma returns for the created row.
function storedRecord(calculation: SimulationCalculation) {
  const data = SimulationCalculationMapper.toPersistence(calculation);
  const decimal = (value: unknown) => new Prisma.Decimal(String(value));
  return {
    id: calculation.id,
    simulationId: calculation.simulationId,
    curveId: calculation.investment.curveId,
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
    incomeTaxRate:
      data.incomeTaxRate == null ? null : decimal(data.incomeTaxRate),
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
    expect(data.curve).toBeUndefined();
    const restored = SimulationCalculationMapper.toDomain(
      storedRecord(calculation),
    );

    expect(restored.id).toBe(calculation.id);
    expect(restored.investment.equals(calculation.investment)).toBe(true);
    expect(restored.calculatedAt.equals(calculation.calculatedAt)).toBe(true);
    const { result } = calculation;
    expect(restored.result.methodologyVersion).toBe(result.methodologyVersion);
    for (const key of Object.keys(
      result.maturitySummary,
    ) as (keyof typeof result.maturitySummary)[]) {
      expect(
        restored.result.maturitySummary[key].equals(
          result.maturitySummary[key],
        ),
      ).toBe(true);
    }
    const taxes = restored.result.taxes;
    expect(taxes.holdingPeriodCalendarDays).toBe(
      result.taxes.holdingPeriodCalendarDays,
    );
    expect(taxes.iof.base.equals(result.taxes.iof.base)).toBe(true);
    expect(taxes.iof.rate?.value.toFixed()).toBe(
      result.taxes.iof.rate?.value.toFixed(),
    );
    expect(taxes.iof.amount.equals(result.taxes.iof.amount)).toBe(true);
    expect(taxes.incomeTax.base.equals(result.taxes.incomeTax.base)).toBe(true);
    expect(taxes.incomeTax.rate?.value.toFixed()).toBe(
      result.taxes.incomeTax.rate?.value.toFixed(),
    );
    expect(taxes.incomeTax.amount.equals(result.taxes.incomeTax.amount)).toBe(
      true,
    );
    expect(taxes.total.equals(result.taxes.total)).toBe(true);
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

  it('stores an income tax exemption as a null rate', () => {
    const calculation = recordedCalculation(ETitleType.LCA, '2026-10-02');
    const data = SimulationCalculationMapper.toPersistence(calculation);

    expect(data.incomeTaxRate).toBeNull();
    expect(data.methodologyVersion).toBe('lca-252-v1');
    const restored = SimulationCalculationMapper.toDomain(
      storedRecord(calculation),
    );
    expect(restored.result.taxes.incomeTax.rate).toBeNull();
    expect(restored.result.taxes.incomeTax.amount.isZero()).toBe(true);
  });
});
