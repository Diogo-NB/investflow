import {
  formatMoney,
  formatPercentOf,
  formatPercentagePoints,
  formatReturnPercent,
} from './format-decimal';

// Intl separates the currency symbol with a no-break space.
const money = (decimal: string) => formatMoney(decimal).replace(/\s/g, ' ');

it('rounds only the displayed money digits', () => {
  expect(money('10168.472562446102628')).toBe('R$ 10.168,47');
  expect(money('0')).toBe('R$ 0,00');
  expect(money('99999999999999999999.995')).toBe(
    'R$ 100.000.000.000.000.000.000,00',
  );
});

it('formats fractions as percentages', () => {
  expect(formatPercentOf('1.1')).toBe('110');
  expect(formatPercentOf('0.125')).toBe('12,5');
  expect(formatPercentOf('0.003450427692416233215455407623')).toBe('0,345');
});

it('formats returns with exactly two decimal places', () => {
  expect(formatReturnPercent('0.102830000000000000000000000000')).toBe(
    '10,28%',
  );
  expect(formatReturnPercent('0.12')).toBe('12,00%');
  expect(formatReturnPercent('0.009488792934583')).toBe('0,95%');
  expect(formatReturnPercent('0')).toBe('0,00%');
  expect(formatReturnPercent('2.5446')).toBe('254,46%');
});

it('formats rate differences in percentage points', () => {
  expect(formatPercentagePoints('0.0033')).toBe('0,33 p.p.');
  expect(formatPercentagePoints('0.00283746')).toBe('0,28 p.p.');
});
