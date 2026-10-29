import {
  CalendarDate,
  EAppErrorCode,
  Money,
  Rate,
} from '@investflow/shared-domain';
import type { TaxAssessment } from '../../taxes/tax-assessment.type';
import { InvestmentProjection } from '../investment-projection.vo';
import { InvestmentTerm } from '../investment-term.vo';

const term = InvestmentTerm.of({
  investmentDate: CalendarDate.of('2026-01-02'),
  maturityDate: CalendarDate.of('2026-01-06'),
  businessDays: 2,
});

const balance = (date: string, gross: string, previous: string) => ({
  date: CalendarDate.of(date),
  grossBalance: Money.of(gross),
  dailyGrossEarnings: Money.of(gross).subtract(Money.of(previous)),
  accumulatedGrossEarnings: Money.of(gross).subtract(Money.of('1000')),
});

const taxes = (total: string): TaxAssessment => ({
  iof: { base: Money.of('100'), rate: Rate.of('0.86'), amount: Money.of('86') },
  incomeTax: {
    base: Money.of('14'),
    rate: Rate.of('0.225'),
    amount: Money.of('3.15'),
  },
  total: Money.of(total),
});

function projection(
  dailyBalances = [
    balance('2026-01-05', '1050', '1000'),
    balance('2026-01-06', '1100', '1050'),
  ],
) {
  return InvestmentProjection.create({
    principal: Money.of('1000'),
    term,
    dailyBalances,
    taxes: taxes('89.15'),
  });
}

describe('InvestmentProjection value object', () => {
  it('derives the gross outcome from the last daily balance', () => {
    const { gross } = projection();
    expect(gross.finalBalance.amount.toFixed()).toBe('1100');
    expect(gross.earnings.amount.toFixed()).toBe('100');
    expect(gross.rateOfReturn.forPeriod.toFixed()).toBe('0.1');
  });

  it('derives the net outcome by deducting every tax from the gross one', () => {
    const { net } = projection();
    expect(net.principal.amount.toFixed()).toBe('1000');
    expect(net.finalBalance.amount.toFixed()).toBe('1010.85');
    expect(net.earnings.amount.toFixed()).toBe('10.85');
    expect(net.rateOfReturn.forPeriod.toFixed()).toBe('0.01085');
  });

  it.each([
    ['a balance missing', [balance('2026-01-06', '1100', '1000')]],
    [
      'a last balance before maturity',
      [
        balance('2026-01-02', '1050', '1000'),
        balance('2026-01-05', '1100', '1050'),
      ],
    ],
  ])('rejects %s as an invariant breach', (_, dailyBalances) => {
    expect(() => projection(dailyBalances)).toThrow(
      expect.objectContaining({
        code: EAppErrorCode.INVESTMENT_SCENARIO_INVARIANT,
      }),
    );
  });
});
