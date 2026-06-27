import { DateRange, InvalidDateRangeError } from './date-range.vo';

describe('DateRange', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  const end = new Date('2026-01-31T00:00:00.000Z');

  describe('DateRange.create()', () => {
    it('returns ok when end is after start', () => {
      const result = DateRange.create(start, end);

      expect(result.isOk()).toBe(true);
      expect(result.value.start).toBe(start);
      expect(result.value.end).toBe(end);
    });

    it('returns an error when end is not after start', () => {
      const result = DateRange.create(end, start);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(InvalidDateRangeError);
    });
  });

  describe('DateRange.of()', () => {
    it('creates a date range', () => {
      const range = DateRange.of(start, end);

      expect(range.start).toBe(start);
      expect(range.end).toBe(end);
    });

    it('throws for invalid ranges', () => {
      expect(() => DateRange.of(end, start)).toThrow(InvalidDateRangeError);
    });
  });
});
