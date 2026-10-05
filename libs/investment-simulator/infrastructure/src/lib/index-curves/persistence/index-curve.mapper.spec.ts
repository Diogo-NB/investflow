import {
  EconomicIndex,
  IndexCurve,
  IndexCurveInterval,
  IndexValue,
  IndexValueConvention,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, CalendarDateRange } from '@investflow/shared-domain';
import { EconomicIndex as DbIndex, Prisma } from '@prisma/client';
import { IndexCurveMapper, IndexCurveRecord } from './index-curve.mapper';

const ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';

function record(overrides: Partial<IndexCurveRecord> = {}): IndexCurveRecord {
  return {
    id: ID,
    name: 'CDI base',
    description: null,
    index: DbIndex.CDI,
    deletedAt: null,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    intervals: [
      {
        curveId: ID,
        startDate: new Date('2026-10-01T00:00:00Z'),
        endDate: new Date('2026-10-31T00:00:00Z'),
        value: new Prisma.Decimal('0.123456789012345678901234567891'),
      },
    ],
    ...overrides,
  };
}

function curve(value: string): IndexCurve {
  return IndexCurve.reconstitute({
    id: ID,
    name: 'CDI base',
    description: null,
    index: EconomicIndex.CDI,
    deletedAt: null,
    intervals: [
      IndexCurveInterval.create(
        CalendarDateRange.of(
          CalendarDate.of('2026-10-01'),
          CalendarDate.of('2026-10-31'),
        ),
        IndexValue.of(value),
      ),
    ],
  });
}

describe('IndexCurveMapper', () => {
  it('round trips the deletion instant', () => {
    const deletedAt = new Date('2026-10-04T12:34:56.789Z');
    const result = IndexCurveMapper.toDomain(record({ deletedAt }));
    expect(result.deletedAt?.toISOString()).toBe(deletedAt.toISOString());
    expect(IndexCurveMapper.toPersistence(result).deletedAt).toEqual(deletedAt);
  });

  it('round trips civil dates and all decimal digits without audit fields in the domain', () => {
    const result = IndexCurveMapper.toDomain(record());
    expect(result.intervals[0].range.start.value).toBe('2026-10-01');
    expect(result.intervals[0].range.end.value).toBe('2026-10-31');
    expect(result.intervals[0].value.value.toString()).toBe(
      '0.123456789012345678901234567891',
    );
    expect(result).not.toHaveProperty('createdAt');
    expect(IndexCurveMapper.toPersistence(result)).toEqual({
      id: ID,
      name: 'CDI base',
      description: null,
      index: DbIndex.CDI,
      deletedAt: null,
      intervals: {
        create: [
          {
            startDate: new Date('2026-10-01T00:00:00Z'),
            endDate: new Date('2026-10-31T00:00:00Z'),
            value: '0.123456789012345678901234567891',
          },
        ],
      },
    });
  });

  it.each([DbIndex.CDI, DbIndex.SELIC])(
    'maps interest index %s and explicit zero',
    (index) => {
      const original = record({ index });
      original.intervals[0].value = new Prisma.Decimal(0);
      const result = IndexCurveMapper.toDomain(original);
      expect(result.index).toBe(index);
      expect(result.intervals[0].value.value.isZero()).toBe(true);
      expect(IndexCurveMapper.toPersistence(result).index).toBe(index);
    },
  );

  it('round trips monthly deflation', () => {
    const original = record({
      index: DbIndex.IPCA,
    });
    original.intervals[0].value = new Prisma.Decimal('-0.004');
    const result = IndexCurveMapper.toDomain(original);
    expect(result.convention).toBe(IndexValueConvention.MONTHLY_VARIATION);
    expect(IndexCurveMapper.toPersistence(result)).toMatchObject({
      index: DbIndex.IPCA,
      intervals: { create: [{ value: '-0.004' }] },
    });
  });

  it.each(['0.1234567890123456789012345678901', '1e35'])(
    'rejects unrepresentable value %s instead of rounding',
    (value) =>
      expect(() => IndexCurveMapper.toPersistence(curve(value))).toThrow(
        'without rounding',
      ),
  );

  it('accepts the largest representable integer portion', () => {
    expect(() =>
      IndexCurveMapper.toPersistence(
        curve('99999999999999999999999999999999999'),
      ),
    ).not.toThrow();
  });

  it('rejects invalid persisted dates and index values', () => {
    const invalidDate = record();
    invalidDate.intervals[0].startDate = new Date('invalid');
    const invalidValue = record();
    invalidValue.intervals[0].value = new Prisma.Decimal(-1);
    expect(() => IndexCurveMapper.toDomain(invalidDate)).toThrow();
    expect(() => IndexCurveMapper.toDomain(invalidValue)).toThrow();
  });
});
