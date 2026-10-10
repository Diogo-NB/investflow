import { EAppErrorCode } from '../foundations/app-error-code.enum';
import { InvalidUtcInstantError, UtcInstant } from './utc-instant.vo';

describe('UtcInstant', () => {
  it.each([
    ['2026-01-02T03:04:05Z', '2026-01-02T03:04:05.000Z'],
    ['2026-01-02T03:04:05.1Z', '2026-01-02T03:04:05.100Z'],
    ['2026-01-02T03:04:05.123Z', '2026-01-02T03:04:05.123Z'],
    ['2026-01-02T03:04:05.1234Z', '2026-01-02T03:04:05.123Z'],
    ['2026-01-02T00:04:05-03:00', '2026-01-02T03:04:05.000Z'],
    ['2026-01-02T06:04:05+03:00', '2026-01-02T03:04:05.000Z'],
    ['2026-01-02T24:00:00Z', '2026-01-03T00:00:00.000Z'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(UtcInstant.ofIso(input).toISOString()).toBe(expected);
  });

  it.each([
    '2026-01-02',
    '2026-01-02T03:04:05',
    '2026-02-30T03:04:05Z',
    '2026-01-02T03:60:00Z',
    '2026-01-02T03:04:60Z',
    '2026-01-02T03:04:05+99:00',
  ])('rejects invalid or ambiguous value %s', (value) => {
    const result = UtcInstant.fromIso(value);

    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidUtcInstantError);
    expect(result.error.code).toBe(EAppErrorCode.INVALID_UTC_INSTANT);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    'rejects invalid epoch milliseconds %s',
    (value) => {
      expect(UtcInstant.fromEpochMilliseconds(value).isErr()).toBe(true);
    },
  );

  it('creates an instant from a valid native Date', () => {
    const result = UtcInstant.fromDate(new Date('2026-01-02T03:04:05.123Z'));

    expect(result.value.toISOString()).toBe('2026-01-02T03:04:05.123Z');
  });

  it('rejects an invalid native Date', () => {
    expect(UtcInstant.fromDate(new Date('invalid')).isErr()).toBe(true);
  });

  it('returns defensive native Date values', () => {
    const source = new Date('2026-01-02T03:04:05Z');
    const instant = UtcInstant.fromDate(source).value;
    const date = instant.date;

    source.setUTCFullYear(2029);
    date.setUTCFullYear(2030);

    expect(instant.date).not.toBe(date);
    expect(instant.toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });

  it('serializes to its canonical UTC scalar', () => {
    const instant = UtcInstant.ofIso('2026-01-02T00:04:05-03:00');

    expect(instant.toString()).toBe('2026-01-02T03:04:05.000Z');
    expect(JSON.stringify({ occurredAt: instant })).toBe(
      '{"occurredAt":"2026-01-02T03:04:05.000Z"}',
    );
  });

  it('compares instants by epoch milliseconds', () => {
    const first = UtcInstant.ofIso('2026-01-02T03:04:05Z');
    const second = UtcInstant.ofIso('2026-01-02T03:04:06Z');

    expect(first.isBefore(second)).toBe(true);
    expect(second.isAfter(first)).toBe(true);
    expect(first.isOnOrBefore(first)).toBe(true);
    expect(first.isOnOrBefore(second)).toBe(true);
    expect(second.isOnOrAfter(first)).toBe(true);
    expect(second.isOnOrAfter(second)).toBe(true);
    expect(
      first.equals(UtcInstant.ofEpochMilliseconds(first.epochMilliseconds)),
    ).toBe(true);
  });
});
