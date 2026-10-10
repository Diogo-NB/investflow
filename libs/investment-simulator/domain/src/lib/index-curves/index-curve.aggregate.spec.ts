import {
  CalendarDate,
  CalendarDateRange,
  UtcInstant,
} from '@investflow/shared-domain';
import { EconomicIndex } from './economic-index.enum';
import { IndexCurveInterval } from './index-curve-interval.vo';
import { CreateIndexCurveProps, IndexCurve } from './index-curve.aggregate';
import { InvalidIndexCurveError } from './index-curve.error';
import { IndexValueConvention } from './index-value-convention.enum';
import { IndexValue } from './index-value.vo';

function interval(start: string, end: string, value = '0.12') {
  return IndexCurveInterval.create(
    CalendarDateRange.of(CalendarDate.of(start), CalendarDate.of(end)),
    IndexValue.of(value),
  );
}

function props(
  overrides: Partial<CreateIndexCurveProps> = {},
): CreateIndexCurveProps {
  return {
    name: ' CDI base ',
    description: ' Cenário base ',
    index: EconomicIndex.CDI,
    intervals: [interval('2026-10-01', '2026-10-31')],
    ...overrides,
  };
}

describe('IndexCurve', () => {
  it('soft deletes idempotently and preserves its content and first instant', () => {
    const curve = IndexCurve.create(props()).value;
    const intervals = curve.intervals;
    const at = UtcInstant.ofIso('2026-10-04T12:00:00Z');
    expect(curve.delete(at)).toBe(curve);
    curve.delete(UtcInstant.ofIso('2026-10-05T12:00:00Z'));
    expect(curve.deletedAt).toBe(at);
    expect(curve.intervals).toEqual(intervals);
    expect(
      curve
        .valueAt(CalendarDate.of('2026-10-15'))
        .value.equals(IndexValue.of('0.12')),
    ).toBe(true);
  });

  it('reconstitutes the deleted state', () => {
    const original = IndexCurve.create(props()).value.delete(
      UtcInstant.ofIso('2026-10-04T12:00:00Z'),
    );
    const curve = IndexCurve.reconstitute({
      id: original.id,
      name: original.name,
      description: original.description,
      index: original.index,
      intervals: original.intervals,
      deletedAt: original.deletedAt,
    });
    expect(curve.deletedAt).toBe(original.deletedAt);
    expect(curve.intervals).toEqual(original.intervals);
  });

  it.each([
    [EconomicIndex.CDI, IndexValueConvention.ANNUAL_EFFECTIVE_252],
    [EconomicIndex.SELIC, IndexValueConvention.ANNUAL_EFFECTIVE_252],
    [EconomicIndex.IPCA, IndexValueConvention.MONTHLY_VARIATION],
  ])(
    'derives the convention for %s on creation and reconstitution',
    (index, convention) => {
      const curve = IndexCurve.create(props({ index })).value;
      expect(curve.convention).toBe(convention);
      const restored = IndexCurve.reconstitute({
        id: curve.id,
        name: curve.name,
        description: curve.description,
        index: curve.index,
        deletedAt: curve.deletedAt,
        intervals: curve.intervals,
      });
      expect(restored.convention).toBe(convention);
    },
  );

  it('creates distinct identities and normalizes its metadata', () => {
    const first = IndexCurve.create(props()).value;
    const second = IndexCurve.create(props({ description: '  ' })).value;
    expect(first.id).not.toBe(second.id);
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.name).toBe('CDI base');
    expect(first.description).toBe('Cenário base');
    expect(second.description).toBeNull();
    expect(first.index).toBe(EconomicIndex.CDI);
    expect(first.deletedAt).toBeNull();
    expect(first.convention).toBe(IndexValueConvention.ANNUAL_EFFECTIVE_252);
    expect(first.getDomainEvents()).toEqual([]);
  });

  it('copies and orders input intervals and returns defensive collections', () => {
    const later = interval('2026-10-08', '2026-10-31', '0.11');
    const earlier = interval('2026-10-01', '2026-10-06');
    const input = [later, earlier];
    const curve = IndexCurve.create(props({ intervals: input })).value;
    expect(input).toEqual([later, earlier]);
    input.pop();
    expect(curve.intervals).toEqual([earlier, later]);
    expect(curve.intervals).not.toBe(curve.intervals);
    expect(
      curve.valueAt(CalendarDate.of('2026-10-08')).value.value.toString(),
    ).toBe('0.11');
  });

  it.each(['2026-10-01', '2026-10-15', '2026-10-31'])(
    'resolves covered reference %s, including both boundaries',
    (reference) => {
      const curve = IndexCurve.create(props()).value;
      expect(
        curve
          .valueAt(CalendarDate.of(reference))
          .value.equals(IndexValue.of('0.12')),
      ).toBe(true);
    },
  );

  it.each(['2026-09-30', '2026-10-07', '2026-11-01'])(
    'reports absence at %s without filling gaps',
    (reference) => {
      const curve = IndexCurve.create(
        props({
          intervals: [
            interval('2026-10-01', '2026-10-06'),
            interval('2026-10-08', '2026-10-31'),
          ],
        }),
      ).value;
      const result = curve.valueAt(CalendarDate.of(reference));
      expect(result.isErr()).toBe(true);
      expect(result.error.code).toBe('INDEX_CURVE_VALUE_NOT_FOUND');
      expect(result.error.metadata).toEqual({ curveId: curve.id, reference });
    },
  );

  it('accepts a point interval with explicit zero for CDI and SELIC', () => {
    for (const index of [EconomicIndex.CDI, EconomicIndex.SELIC]) {
      const curve = IndexCurve.create(
        props({
          index,
          intervals: [interval('2026-10-05', '2026-10-05', '0')],
        }),
      ).value;
      expect(
        curve.valueAt(CalendarDate.of('2026-10-05')).value.value.isZero(),
      ).toBe(true);
    }
  });

  it.each<Partial<CreateIndexCurveProps>>([
    { name: '   ' },
    { intervals: [] },
    { intervals: [interval('2026-10-01', '2026-10-31', '-0.01')] },
    {
      index: EconomicIndex.SELIC,
      intervals: [interval('2026-10-01', '2026-10-31', '-0.01')],
    },
    {
      intervals: [
        interval('2026-10-01', '2026-10-10'),
        interval('2026-10-10', '2026-10-31'),
      ],
    },
    {
      intervals: [
        interval('2026-10-01', '2026-10-31'),
        interval('2026-10-05', '2026-10-05'),
      ],
    },
    {
      intervals: [
        interval('2026-10-01', '2026-10-31'),
        interval('2026-10-01', '2026-10-31'),
      ],
    },
  ])('rejects invalid curve content %#', (overrides) => {
    const result = IndexCurve.create(props(overrides));
    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidIndexCurveError);
    expect(result.error.code).toBe('INVALID_INDEX_CURVE');
  });

  it('resolves monthly inflation, deflation and repeated monthly values', () => {
    const curve = IndexCurve.create(
      props({
        index: EconomicIndex.IPCA,
        intervals: [
          interval('2024-02-01', '2024-02-29', '-0.004'),
          interval('2024-03-01', '2024-04-30', '0.003'),
        ],
      }),
    ).value;
    for (const reference of ['2024-02-01', '2024-02-15', '2024-02-29']) {
      expect(
        curve.valueAt(CalendarDate.of(reference)).value.value.toString(),
      ).toBe('-0.004');
    }
    expect(
      curve.valueAt(CalendarDate.of('2024-04-30')).value.value.toString(),
    ).toBe('0.003');
    expect(curve.valueAt(CalendarDate.of('2024-01-01')).isErr()).toBe(true);
  });

  it.each([
    ['2024-02-02', '2024-02-29'],
    ['2024-02-01', '2024-02-28'],
    ['2024-02-01', '2024-02-01'],
  ])('rejects incomplete monthly range %s to %s', (start, end) => {
    expect(
      IndexCurve.create(
        props({
          index: EconomicIndex.IPCA,
          intervals: [interval(start, end)],
        }),
      ).isErr(),
    ).toBe(true);
  });

  it('resolves many references in order or reports every uncovered one', () => {
    const curve = IndexCurve.create(
      props({
        intervals: [
          interval('2026-10-01', '2026-10-02', '0.10'),
          interval('2026-10-05', '2026-10-05', '0.11'),
        ],
      }),
    ).value;
    const dates = (...isos: string[]) =>
      isos.map((iso) => CalendarDate.of(iso));

    expect(
      curve
        .valuesAt(dates('2026-10-02', '2026-10-05', '2026-10-01'))
        .value.map((value) => value.value.toString()),
    ).toEqual(['0.1', '0.11', '0.1']);
    const missing = curve.valuesAt(
      dates('2026-10-02', '2026-10-03', '2026-10-06'),
    );
    expect(missing.error.code).toBe('INDEX_CURVE_COVERAGE_MISSING');
    expect(missing.error.metadata?.['missingReferences']).toEqual([
      '2026-10-03',
      '2026-10-06',
    ]);
  });

  it('reconstitutes persisted state directly and preserves its identity', () => {
    const original = IndexCurve.create(props()).value;
    const curve = IndexCurve.reconstitute({
      id: 'curve-id',
      name: original.name,
      description: original.description,
      index: original.index,
      deletedAt: original.deletedAt,
      intervals: original.intervals,
    });
    expect(curve.id).toBe('curve-id');
    expect(curve.name).toBe(original.name);
    expect(curve.description).toBe(original.description);
    expect(curve.intervals).toEqual(original.intervals);
  });
});
