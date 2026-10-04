import { Money } from '@investflow/shared-domain';
import { formatMoney, formatMoneyPtBr } from './money.formatter';

describe('money formatters', () => {
  it('formats BRL using PT-BR conventions', () => {
    expect(formatMoneyPtBr(Money.of('1234.56', 'BRL'))).toBe(
      'R$\u00a01.234,56',
    );
  });

  it('uses the currency carried by Money', () => {
    expect(formatMoneyPtBr(Money.of('1234.56', 'USD'))).toBe(
      'US$\u00a01.234,56',
    );
  });

  it('supports an explicit locale', () => {
    expect(formatMoney(Money.of('1234.56', 'USD'), 'en-US')).toBe('$1,234.56');
  });

  it('supports explicit currency display and fraction options', () => {
    expect(
      formatMoneyPtBr(Money.of('1234.567', 'BRL'), {
        currencyDisplay: 'code',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    ).toBe('BRL\u00a01.234,567');
  });

  it('does not coerce large decimal amounts through a JavaScript number', () => {
    expect(
      formatMoney(Money.of('12345678901234567890.12', 'USD'), 'en-US'),
    ).toBe('$12,345,678,901,234,567,890.12');
  });

  it('rejects an invalid locale', () => {
    expect(() => formatMoney(Money.of(10), 'not_a_valid_locale')).toThrow(
      RangeError,
    );
  });
});
