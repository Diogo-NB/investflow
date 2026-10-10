import { EAppErrorCode } from '../foundations/app-error-code.enum';
import Decimal from 'decimal.js';
import { InvalidRateError, Rate } from './rate.vo';

describe('Rate', () => {
  it.each([1, 0.01, 105, '7.5'])(
    'creates a rate from the positive value %p',
    (value) => {
      const result = Rate.create(value);

      expect(result.isOk()).toBe(true);
      expect(result.value.value.toString()).toBe(new Decimal(value).toString());
    },
  );

  it('preserves a long decimal string without number conversion', () => {
    const value = '12345678901234567890.123456789012345678901';

    expect(Rate.of(value).value.toString()).toBe(value);
  });

  it.each([0, -1, 'invalid', Number.NaN, Infinity, -Infinity])(
    'returns InvalidRateError for %p',
    (value) => {
      const result = Rate.create(value);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvalidRateError);
      expect(result.error.code).toBe(EAppErrorCode.INVALID_RATE);
    },
  );

  it('throws InvalidRateError from of()', () => {
    expect(() => Rate.of(0)).toThrow(InvalidRateError);
  });

  it('compares rates by decimal value', () => {
    expect(Rate.of('105.0').equals(Rate.of('105'))).toBe(true);
    expect(Rate.of('105').equals(Rate.of('105.1'))).toBe(false);
  });
});
