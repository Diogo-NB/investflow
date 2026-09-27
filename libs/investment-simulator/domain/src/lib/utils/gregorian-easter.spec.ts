import { calculateGregorianEasterSunday } from './gregorian-easter';

describe('calculateGregorianEasterSunday', () => {
  it.each([
    [1900, '1900-04-15'],
    [1954, '1954-04-18'],
    [2000, '2000-04-23'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2099, '2099-04-12'],
  ])('calculates Easter Sunday for %i', (year, expected) => {
    expect(calculateGregorianEasterSunday(year).toIsoString()).toBe(expected);
  });
});
