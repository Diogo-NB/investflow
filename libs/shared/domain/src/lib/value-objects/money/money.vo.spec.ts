import Decimal from 'decimal.js';
import { Money, InvalidMoneyError } from './money.vo';

describe('Money', () => {
  describe('Money.create()', () => {
    it('returns ok for positive values', () => {
      const result = Money.create('100.50');

      expect(result.isOk()).toBe(true);
      expect(result.value.amount.toString()).toBe('100.5');
    });

    it('returns an error for invalid values', () => {
      const result = Money.create(0);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvalidMoneyError);
    });
  });

  describe('Money.of()', () => {
    it('creates a Money instance from a positive Decimal', () => {
      const money = Money.of(new Decimal('100.50'));
      expect(money.amount.toString()).toBe('100.5');
      expect(money.currency).toBe('BRL');
    });

    it('creates a Money instance from a positive number', () => {
      const money = Money.of(100);
      expect(money.amount.toNumber()).toBe(100);
    });

    it('creates a Money instance from a positive string', () => {
      const money = Money.of('250.75');
      expect(money.amount.toString()).toBe('250.75');
    });

    it('throws InvalidMoneyError for zero', () => {
      expect(() => Money.of(0)).toThrow(InvalidMoneyError);
    });

    it('throws InvalidMoneyError for negative values', () => {
      expect(() => Money.of(-1)).toThrow(InvalidMoneyError);
    });

    it('throws InvalidMoneyError for negative Decimal', () => {
      expect(() => Money.of(new Decimal('-0.01'))).toThrow(InvalidMoneyError);
    });
  });

  describe('add()', () => {
    it('returns a new Money with the summed amount', () => {
      const a = Money.of('100');
      const b = Money.of('50.25');
      expect(a.add(b).amount.toString()).toBe('150.25');
    });

    it('does not mutate the original instances', () => {
      const a = Money.of('100');
      const b = Money.of('50');
      a.add(b);
      expect(a.amount.toString()).toBe('100');
    });
  });

  describe('subtract()', () => {
    it('returns a new Money with the difference', () => {
      const a = Money.of('200');
      const b = Money.of('50');
      expect(a.subtract(b).amount.toString()).toBe('150');
    });

    it('throws when result would be zero', () => {
      const a = Money.of('50');
      const b = Money.of('50');
      expect(() => a.subtract(b)).toThrow(InvalidMoneyError);
    });

    it('throws when result would be negative', () => {
      const a = Money.of('10');
      const b = Money.of('20');
      expect(() => a.subtract(b)).toThrow(InvalidMoneyError);
    });
  });

  describe('comparison methods', () => {
    const low = Money.of('10');
    const high = Money.of('20');
    const same = Money.of('10');

    it('greaterThan() returns true when this > other', () => {
      expect(high.greaterThan(low)).toBe(true);
    });

    it('greaterThan() returns false when this < other', () => {
      expect(low.greaterThan(high)).toBe(false);
    });

    it('greaterThan() returns false when equal', () => {
      expect(low.greaterThan(same)).toBe(false);
    });

    it('greaterThanOrEqual() returns true when this > other', () => {
      expect(high.greaterThanOrEqual(low)).toBe(true);
    });

    it('greaterThanOrEqual() returns true when equal', () => {
      expect(low.greaterThanOrEqual(same)).toBe(true);
    });

    it('lessThan() returns true when this < other', () => {
      expect(low.lessThan(high)).toBe(true);
    });

    it('lessThan() returns false when this >= other', () => {
      expect(high.lessThan(low)).toBe(false);
    });

    it('equals() returns true for same amount', () => {
      expect(low.equals(same)).toBe(true);
    });

    it('equals() returns false for different amounts', () => {
      expect(low.equals(high)).toBe(false);
    });
  });
});
