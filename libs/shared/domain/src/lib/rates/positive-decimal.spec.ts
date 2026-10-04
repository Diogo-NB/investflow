import Decimal from 'decimal.js';
import {
  InvalidPositiveDecimalError,
  parsePositiveDecimal,
} from './positive-decimal';

describe('parsePositiveDecimal', () => {
  it.each([1, 0.01, 105, '12345678901234567890.123456789012345678901'])(
    'accepts the positive value %p',
    (value) => {
      const result = parsePositiveDecimal(value);

      expect(result.isOk()).toBe(true);
      expect(result.value.toString()).toBe(new Decimal(value).toString());
    },
  );

  it('accepts a Decimal instance', () => {
    const result = parsePositiveDecimal(new Decimal('7.5'));

    expect(result.isOk()).toBe(true);
    expect(result.value.toString()).toBe('7.5');
  });

  it.each([0, -1, 'invalid', Number.NaN, Infinity, -Infinity])(
    'rejects the invalid value %p',
    (value) => {
      const result = parsePositiveDecimal(value);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvalidPositiveDecimalError);
      expect(result.error.code).toBe('INVALID_POSITIVE_DECIMAL');
      expect(result.error.metadata).toEqual({
        reason: expect.any(String),
        input: String(value),
      });
    },
  );
});
