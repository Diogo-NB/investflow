import {
  fitsDecimalStorage,
  isPositiveDecimal,
  parseBrazilianDecimal,
  shiftDecimal,
  toBrazilianInput,
} from './decimal-string';

describe('parseBrazilianDecimal', () => {
  it.each([
    ['10.000,50', '10000.5'],
    ['10000,50', '10000.5'],
    ['R$ 1.234.567,891', '1234567.891'],
    ['1000.5', '1000.5'],
    ['10.000', '10000'],
    ['007', '7'],
    ['0,10', '0.1'],
    ['110', '110'],
  ])('reads %s as %s', (text, expected) => {
    expect(parseBrazilianDecimal(text)).toBe(expected);
  });

  it.each(['', 'abc', '1,2,3', '10.00,5', '-5', '1e3', ','])(
    'rejects %j',
    (text) => {
      expect(parseBrazilianDecimal(text)).toBeNull();
    },
  );
});

describe('shiftDecimal', () => {
  it.each([
    ['110', -2, '1.1'],
    ['12.5', -2, '0.125'],
    ['0.5', -2, '0.005'],
    ['1.1', 2, '110'],
    ['0.125', 2, '12.5'],
    ['0.003450427692416233215455407623', 2, '0.3450427692416233215455407623'],
    ['0', 2, '0'],
  ])('shifts %s by %i to %s', (decimal, places, expected) => {
    expect(shiftDecimal(decimal, places)).toBe(expected);
  });
});

it('checks positivity and storage limits without converting to numbers', () => {
  expect(isPositiveDecimal('0.000000001')).toBe(true);
  expect(isPositiveDecimal('0')).toBe(false);
  expect(fitsDecimalStorage(`${'9'.repeat(35)}.${'1'.repeat(30)}`)).toBe(true);
  expect(fitsDecimalStorage('9'.repeat(36))).toBe(false);
  expect(fitsDecimalStorage(`1.${'1'.repeat(31)}`)).toBe(false);
  expect(toBrazilianInput('12.5')).toBe('12,5');
});
