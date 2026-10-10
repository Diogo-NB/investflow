import { Money } from '@investflow/shared-domain';
import { CdbTaxCalculator } from './cdb-tax-calculator.domain-service';

const calculator = new CdbTaxCalculator();
function calculate(days: number, earnings = '100') {
  return calculator.calculate(Money.of(earnings), days);
}

describe('CdbTaxCalculator domain service', () => {
  const iofTable = [
    96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36,
    33, 30, 26, 23, 20, 16, 13, 10, 6, 3,
  ];

  it.each(iofTable.map((percentage, index) => [index + 1, percentage]))(
    'uses the IOF table at %s days (%s percent)',
    (days, percentage) => {
      expect(calculate(days).iof.amount.toString()).toBe(String(percentage));
    },
  );

  it('applies IOF before IR using the PRD ten-day example', () => {
    const result = calculate(10);
    expect(result.iof.amount.toString()).toBe('66');
    expect(result.incomeTax.amount.toString()).toBe('7.65');
    expect(result.totalTaxes.amount.toString()).toBe('73.65');
    expect(Money.of(100).subtract(result.totalTaxes).amount.toString()).toBe(
      '26.35',
    );
  });

  it.each([30, 31, 180, 721])(
    'charges no IOF after %s calendar days',
    (days) => {
      expect(calculate(days).iof.isZero()).toBe(true);
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
    expect(calculate(days).incomeTax.amount.toString()).toBe(expected);
  });

  it.each(['0', '-100'])('charges no tax on earnings of %s', (earnings) => {
    const result = calculate(10, earnings);
    expect(result.iof.isZero()).toBe(true);
    expect(result.incomeTax.isZero()).toBe(true);
    expect(result.totalTaxes.isZero()).toBe(true);
  });

  it('preserves fractional tax precision', () => {
    expect(
      calculate(181, '0.123456789123456789').incomeTax.amount.toString(),
    ).toBe('0.0246913578246913578');
  });
});
