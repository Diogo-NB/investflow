import { formatMoney, formatPercentOf } from './format-decimal';

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
