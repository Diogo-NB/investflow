import { CalendarDate, EAppErrorCode } from '@investflow/shared-domain';
import { InvestmentTerm } from './investment-term.vo';

const term = (investment: string, maturity: string, businessDays: number) =>
  InvestmentTerm.of({
    investmentDate: CalendarDate.of(investment),
    maturityDate: CalendarDate.of(maturity),
    businessDays,
  });

describe('InvestmentTerm value object', () => {
  it('counts calendar days excluding the investment date', () => {
    const value = term('2026-01-02', '2026-01-06', 2);
    expect(value.calendarDays).toBe(4);
    expect(value.businessDays).toBe(2);
  });

  it.each([
    ['a maturity not after the investment', '2026-01-06', '2026-01-06', 1],
    ['no business days', '2026-01-02', '2026-01-06', 0],
    ['more business days than calendar days', '2026-01-02', '2026-01-06', 5],
  ])('rejects %s as an invariant breach', (_, start, end, days) => {
    expect(() => term(start, end, days)).toThrow(
      expect.objectContaining({
        code: EAppErrorCode.INVESTMENT_SCENARIO_INVARIANT,
      }),
    );
  });

  it('compares by value', () => {
    expect(
      term('2026-01-02', '2026-01-06', 2).equals(
        term('2026-01-02', '2026-01-06', 2),
      ),
    ).toBe(true);
    expect(
      term('2026-01-02', '2026-01-06', 2).equals(
        term('2026-01-02', '2026-01-06', 3),
      ),
    ).toBe(false);
  });
});
