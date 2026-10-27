import { CalendarDate, Money } from '@investflow/shared-domain';
import { InvestmentTerm } from '../investment-term.vo';
import { RateOfReturn } from '../rate-of-return.vo';

const term = (businessDays: number) =>
  InvestmentTerm.of({
    investmentDate: CalendarDate.of('2026-01-02'),
    maturityDate: CalendarDate.of('2028-01-03'),
    businessDays,
  });

describe('RateOfReturn value object', () => {
  it('annualizes over 252 business days and derives the equivalent monthly rate', () => {
    // A prefixed 12% CDB over 504 business days, gross and after 15% income tax.
    const principal = Money.of('1000');
    const gross = RateOfReturn.between(
      principal,
      Money.of('1254.4'),
      term(504),
    );
    const net = RateOfReturn.between(principal, Money.of('1216.24'), term(504));

    expect(gross.forPeriod.toFixed()).toBe('0.2544');
    expect(gross.annual.toFixed(12)).toBe('0.120000000000');
    expect(gross.monthly.toFixed(10)).toBe('0.0094887929');
    expect(net.forPeriod.toFixed()).toBe('0.21624');
    expect(net.annual.toFixed(4)).toBe('0.1028');
    expect(net.monthly.plus(1).pow(12).minus(1).toFixed(12)).toBe(
      net.annual.toFixed(12),
    );
  });

  it('compares by value', () => {
    const of = (balance: string) =>
      RateOfReturn.between(Money.of('1000'), Money.of(balance), term(252));
    expect(of('1100').equals(of('1100'))).toBe(true);
    expect(of('1100').equals(of('1080'))).toBe(false);
  });
});
