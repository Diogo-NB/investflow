import { IndexValue, InvalidIndexValueError } from './index-value.vo';

describe('IndexValue', () => {
  it.each(['0', '0.12', '-0.004', '-0.999999999999999999999999999999'])(
    'preserves the decimal value %s',
    (value) => {
      const result = IndexValue.create(value);
      expect(result.isOk()).toBe(true);
      expect(result.value.value.toString()).toBe(value);
    },
  );

  it.each(['invalid', 'NaN', 'Infinity', '-Infinity', '-1', '-1.01'])(
    'rejects %s',
    (value) => {
      const result = IndexValue.create(value);
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvalidIndexValueError);
      expect(result.error.code).toBe('INVALID_INDEX_VALUE');
    },
  );

  it('compares decimals by value and exposes typed invariant errors', () => {
    expect(IndexValue.of('0.120').equals(IndexValue.of('0.12'))).toBe(true);
    expect(IndexValue.of('0.12').equals(IndexValue.of('0.13'))).toBe(false);
    expect(() => IndexValue.of('-1')).toThrow(InvalidIndexValueError);
  });
});
