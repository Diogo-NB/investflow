import { Money } from '@investflow/shared-domain';
import { ETitleType } from '../offers/title-type.enum';
import { INCOME_TAX_BRACKETS } from './income-tax-policy.domain-service';
import {
  IOF_DAILY_RATES,
  IOF_EXEMPT_FROM_CALENDAR_DAYS,
} from './iof-policy.domain-service';
import { TaxCalculator } from './tax-calculator.domain-service';

const calculator = new TaxCalculator();
function calculate(days: number, earnings = '100', titleType = ETitleType.CDB) {
  return calculator.assess(titleType, Money.of(earnings), days);
}

describe('TaxCalculator domain service', () => {
  const iofTable = [
    96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36,
    33, 30, 26, 23, 20, 16, 13, 10, 6, 3,
  ];

  it.each(iofTable.map((percentage, index) => [index + 1, percentage]))(
    'uses the IOF table at %s days (%s percent)',
    (days, percentage) => {
      expect(calculate(days).iof.amount.amount.toString()).toBe(
        String(percentage),
      );
    },
  );

  it('assesses each tax with its base and rate', () => {
    const assessment = calculate(10);
    expect(assessment.holdingPeriodCalendarDays).toBe(10);
    expect(assessment.iof.base.amount.toString()).toBe('100');
    expect(assessment.iof.rate?.value.toString()).toBe('0.66');
    expect(assessment.incomeTax.base.amount.toString()).toBe('34');
    expect(assessment.incomeTax.rate?.value.toString()).toBe('0.225');

    const exempt = calculate(400, '-5');
    expect(exempt.iof.rate).toBeNull();
    expect(exempt.iof.base.isZero).toBe(true);
    expect(exempt.incomeTax.rate?.value.toString()).toBe('0.175');
  });

  it('publishes contiguous income tax brackets ending in an open one', () => {
    INCOME_TAX_BRACKETS.forEach((bracket, index) => {
      const previous = INCOME_TAX_BRACKETS[index - 1];
      expect(bracket.fromCalendarDays).toBe(
        previous ? (previous.upToCalendarDays ?? 0) + 1 : 1,
      );
    });
    expect(INCOME_TAX_BRACKETS.at(-1)?.upToCalendarDays).toBeNull();
    expect(IOF_DAILY_RATES).toHaveLength(IOF_EXEMPT_FROM_CALENDAR_DAYS - 1);
  });

  it('applies IOF before IR using the PRD ten-day example', () => {
    const result = calculate(10);
    expect(result.iof.amount.amount.toString()).toBe('66');
    expect(result.incomeTax.amount.amount.toString()).toBe('7.65');
    expect(result.total.amount.toString()).toBe('73.65');
    expect(Money.of(100).subtract(result.total).amount.toString()).toBe(
      '26.35',
    );
  });

  it.each([30, 31, 180, 721])(
    'charges no IOF after %s calendar days',
    (days) => {
      expect(calculate(days).iof.amount.isZero).toBe(true);
    },
  );

  it.each<[number, string]>([
    [30, '22.5'],
    [180, '22.5'],
    [181, '20'],
    [360, '20'],
    [361, '17.5'],
    [720, '17.5'],
    [721, '15'],
  ])('charges the correct income tax at %s days', (days, expected) => {
    expect(calculate(days).incomeTax.amount.amount.toString()).toBe(expected);
  });

  it.each(['0', '-100'])('charges no tax on earnings of %s', (earnings) => {
    const result = calculate(10, earnings);
    expect(result.iof.amount.isZero).toBe(true);
    expect(result.incomeTax.amount.isZero).toBe(true);
    expect(result.total.isZero).toBe(true);
  });

  it('preserves fractional tax precision', () => {
    expect(
      calculate(181, '0.123456789123456789').incomeTax.amount.amount.toString(),
    ).toBe('0.0246913578246913578');
  });

  it.each([ETitleType.LCI, ETitleType.LCA])(
    'exempts %s earnings from income tax',
    (titleType) => {
      const result = calculate(10, '100', titleType);
      expect(result.incomeTax.base.amount.toString()).toBe('34');
      expect(result.incomeTax.rate).toBeNull();
      expect(result.incomeTax.amount.isZero).toBe(true);
      expect(result.total.amount.toString()).toBe('66');
      expect(calculate(400, '100', titleType).total.isZero).toBe(true);
    },
  );
});
