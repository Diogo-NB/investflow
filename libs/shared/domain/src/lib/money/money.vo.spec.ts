import Decimal from 'decimal.js';
import {
  InvalidMoneyError,
  Money,
  MoneyCurrencyMismatchError,
} from './money.vo';

describe('Money', () => {
  describe('create()', () => {
    it('creates a BRL amount by default', () => {
      const result = Money.create('100.50');

      expect(result.isOk()).toBe(true);
      expect(result.value.amount.toString()).toBe('100.5');
      expect(result.value.currency).toBe('BRL');
    });

    it('accepts zero', () => {
      const result = Money.create(0, 'USD');

      expect(result.isOk()).toBe(true);
      expect(result.value.isZero).toBe(true);
      expect(result.value.currency).toBe('USD');
    });

    it.each([['not-a-number'], [Number.NaN], [Number.POSITIVE_INFINITY]])(
      'returns InvalidMoneyError for a malformed or non-finite amount: %s',
      (amount) => {
        const result = Money.create(amount);

        expect(result.isErr()).toBe(true);
        expect(result.error).toBeInstanceOf(InvalidMoneyError);
      },
    );

    it('accepts negative amounts', () => {
      const result = Money.create('-0.01');

      expect(result.isOk()).toBe(true);
      expect(result.value.amount.toString()).toBe('-0.01');
      expect(result.value.isNegative).toBe(true);
    });

    it.each(['brl', 'REAL', 'BR'])(
      'rejects invalid currency code %s',
      (currency) => {
        const result = Money.create(10, currency);

        expect(result.isErr()).toBe(true);
        expect(result.error).toBeInstanceOf(InvalidMoneyError);
      },
    );
  });

  describe('of()', () => {
    it('creates money from Decimal, number, and string amounts', () => {
      expect(Money.of(new Decimal('100.50')).amount.toString()).toBe('100.5');
      expect(Money.of(100).amount.toNumber()).toBe(100);
      expect(Money.of('250.75').amount.toString()).toBe('250.75');
    });

    it('throws InvalidMoneyError for invalid input', () => {
      expect(() => Money.of('invalid')).toThrow(InvalidMoneyError);
      expect(() => Money.of(1, 'brl')).toThrow(InvalidMoneyError);
    });
  });

  describe('zero()', () => {
    it('creates zero in the requested currency', () => {
      const money = Money.zero('EUR');

      expect(money.isZero).toBe(true);
      expect(money.currency).toBe('EUR');
    });
  });

  describe('arithmetic', () => {
    it('adds amounts without mutating either operand', () => {
      const left = Money.of('100');
      const right = Money.of('50.25');

      expect(left.add(right).amount.toString()).toBe('150.25');
      expect(left.amount.toString()).toBe('100');
      expect(right.amount.toString()).toBe('50.25');
    });

    it('allows subtraction to produce zero', () => {
      expect(Money.of('50').subtract(Money.of('50')).isZero).toBe(true);
    });

    it('allows subtraction to produce a negative amount', () => {
      const result = Money.of('10').subtract(Money.of('20'));

      expect(result.amount.toString()).toBe('-10');
      expect(result.isNegative).toBe(true);
    });

    it('rejects arithmetic between different currencies', () => {
      const brl = Money.of(10, 'BRL');
      const usd = Money.of(10, 'USD');

      expect(() => brl.add(usd)).toThrow(MoneyCurrencyMismatchError);
      expect(() => brl.subtract(usd)).toThrow(MoneyCurrencyMismatchError);
    });

    it('multiplies by a decimal factor while preserving currency and precision', () => {
      const money = Money.of('100.123456789', 'USD');
      const factor = new Decimal('1.0001');
      const result = money.times(factor);

      expect(result.amount.toString()).toBe('100.1334691346789');
      expect(result.currency).toBe('USD');
      expect(money.amount.toString()).toBe('100.123456789');
      expect(factor.toString()).toBe('1.0001');
    });

    it.each([
      ['0', '0'],
      ['1', '10'],
      ['-2', '-20'],
    ])('multiplies by %s to produce %s', (factor, expected) => {
      const result = Money.of('10', 'EUR').times(new Decimal(factor));
      expect(result.amount.toString()).toBe(expected);
      expect(result.currency).toBe('EUR');
    });

    it.each(['NaN', 'Infinity'])(
      'rejects a non-finite product with factor %s',
      (factor) => {
        expect(() => Money.of(10).times(new Decimal(factor))).toThrow(
          InvalidMoneyError,
        );
      },
    );
  });

  describe('comparison', () => {
    const low = Money.of('10');
    const high = Money.of('20');
    const same = Money.of('10');

    it('compares amounts in the same currency', () => {
      expect(high.greaterThan(low)).toBe(true);
      expect(high.greaterThanOrEqual(low)).toBe(true);
      expect(low.greaterThanOrEqual(same)).toBe(true);
      expect(low.lessThan(high)).toBe(true);
      expect(low.lessThanOrEqual(high)).toBe(true);
      expect(low.lessThanOrEqual(same)).toBe(true);
      expect(high.isPositive).toBe(true);
      expect(Money.of(-1).isNegative).toBe(true);
    });

    it('rejects comparison between different currencies', () => {
      expect(() => Money.of(10, 'BRL').lessThan(Money.of(10, 'USD'))).toThrow(
        MoneyCurrencyMismatchError,
      );
    });

    it('includes currency in equality', () => {
      expect(low.equals(same)).toBe(true);
      expect(low.equals(high)).toBe(false);
      expect(low.equals(Money.of(10, 'USD'))).toBe(false);
    });
  });

  describe('serialization', () => {
    const money = Money.of('1234.50', 'USD');

    it('has a canonical string representation', () => {
      expect(money.toString()).toBe('1234.5 USD');
    });

    it('serializes amount without losing decimal precision', () => {
      expect(money.toJSON()).toEqual({ amount: '1234.5', currency: 'USD' });
      expect(JSON.stringify(money)).toBe(
        '{"amount":"1234.5","currency":"USD"}',
      );
    });
  });
});
