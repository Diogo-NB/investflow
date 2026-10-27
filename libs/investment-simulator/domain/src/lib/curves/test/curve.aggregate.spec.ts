import {
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  UtcInstant,
} from '@investflow/shared-domain';
import { CurveInterval } from '../curve-interval.vo';
import { CreateCurveProps, Curve } from '../curve.aggregate';
import { InvalidCurveError } from '../curve.error';
import {
  CurveCreated,
  CurveDeleted,
  CurveDetailsChanged,
  CurveValuesChanged,
} from '../curve.events';
import { EEconomicIndex } from '../economic-index.enum';
import { EIndexValueConvention } from '../index-value-convention.enum';
import { IndexValue } from '../index-value.vo';

const AT = UtcInstant.ofIso('2026-10-04T12:00:00Z');
const LATER = UtcInstant.ofIso('2026-10-05T12:00:00Z');

function interval(start: string, end: string, value = '0.12') {
  return CurveInterval.create(
    CalendarDateRange.of(CalendarDate.of(start), CalendarDate.of(end)),
    IndexValue.of(value),
  );
}

function props(overrides: Partial<CreateCurveProps> = {}): CreateCurveProps {
  return {
    ownerId: 'user-1',
    name: ' CDI base ',
    description: ' Cenário base ',
    index: EEconomicIndex.CDI,
    intervals: [interval('2026-10-01', '2026-10-31')],
    ...overrides,
  };
}

function create(overrides: Partial<CreateCurveProps> = {}) {
  return Curve.create(props(overrides), AT);
}

function restore(curve: Curve): Curve {
  return Curve.reconstitute({
    id: curve.id,
    index: curve.index,
    ownerId: curve.ownerId,
    name: curve.name,
    description: curve.description,
    intervals: curve.intervals,
    revision: curve.revision,
    valuesRevision: curve.valuesRevision,
    deletedAt: curve.deletedAt,
  });
}

describe('Curve', () => {
  it('creates distinct identities at revision 1, normalizes metadata and raises a creation event', () => {
    const first = create().value;
    const second = create({ description: '  ' }).value;
    expect(first.id).not.toBe(second.id);
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.name).toBe('CDI base');
    expect(first.description).toBe('Cenário base');
    expect(second.description).toBeNull();
    expect(first.revision).toBe(1);
    expect(first.valuesRevision).toBe(1);
    expect(first.deletedAt).toBeNull();
    const [event] = first.getDomainEvents();
    expect(event).toBeInstanceOf(CurveCreated);
    // Events are notifications: identifiers only, never the curve's content.
    expect({ ...event }).toEqual({
      eventId: expect.any(String),
      eventType: 'CurveCreated',
      aggregateType: 'Curve',
      aggregateId: first.id,
      context: 'investment-simulator',
      version: 1,
      occurredAt: AT,
    });
  });

  it('reconstitutes persisted state without raising events', () => {
    const original = create().value;
    const curve = restore(original);
    expect(curve.id).toBe(original.id);
    expect(curve.revision).toBe(1);
    expect(curve.intervals).toEqual(original.intervals);
    expect(curve.getDomainEvents()).toEqual([]);
  });

  it.each([
    [EEconomicIndex.CDI, EIndexValueConvention.ANNUAL_EFFECTIVE_252],
    [EEconomicIndex.SELIC, EIndexValueConvention.ANNUAL_EFFECTIVE_252],
    [EEconomicIndex.IPCA, EIndexValueConvention.MONTHLY_VARIATION],
  ])('derives the convention for %s', (index, convention) => {
    const curve = create({
      index,
      intervals: [interval('2026-10-01', '2026-10-31')],
    }).value;
    expect(curve.convention).toBe(convention);
    expect(restore(curve).convention).toBe(convention);
  });

  it('decides visibility and ownership, with null as the system', () => {
    const own = create().value;
    const system = create({ ownerId: null }).value;
    expect(own.isVisibleTo('user-1')).toBe(true);
    expect(own.isVisibleTo('user-2')).toBe(false);
    expect(own.isVisibleTo(null)).toBe(false);
    expect(own.canBeChangedBy('user-1')).toBe(true);
    expect(system.isVisibleTo('user-2')).toBe(true);
    expect(system.canBeChangedBy('user-2')).toBe(false);
    expect(system.canBeChangedBy(null)).toBe(true);
  });

  it("duplicates into the actor's private copy with the same content", () => {
    const source = create({ ownerId: null }).value;
    const copy = source.duplicateFor('user-2', LATER).value;
    expect(copy.id).not.toBe(source.id);
    expect(copy.ownerId).toBe('user-2');
    expect(copy.index).toBe(source.index);
    expect(copy.name).toBe('CDI base (cópia)');
    expect(copy.description).toBe(source.description);
    expect(copy.intervals).toEqual(source.intervals);
    expect(copy.revision).toBe(1);
    expect(copy.getDomainEvents()).toEqual([expect.any(CurveCreated)]);
  });

  it('accepts the current revision and reports a conflict otherwise', () => {
    const curve = create().value;
    expect(curve.assertRevision(1).isOk()).toBe(true);
    const conflict = curve.assertRevision(2).error;
    expect(conflict.code).toBe(EAppErrorCode.CURVE_REVISION_CONFLICT);
    expect(conflict.kind).toBe('conflict');
  });

  it('edits supplied fields, increments both revisions once and raises both change events', () => {
    const curve = restore(
      create({
        intervals: [
          interval('2026-10-01', '2026-10-15'),
          interval('2026-10-16', '2026-10-31'),
        ],
      }).value,
    );

    const result = curve.edit(
      {
        name: 'Otimista',
        description: null,
        intervals: [
          interval('2026-10-01', '2026-10-15'),
          interval('2026-10-16', '2026-10-31', '0.110'),
          interval('2026-11-01', '2026-11-30', '0.11'),
        ],
      },
      LATER,
    );

    expect(result.isOk()).toBe(true);
    expect(curve.revision).toBe(2);
    expect(curve.valuesRevision).toBe(2);
    expect(curve.name).toBe('Otimista');
    expect(curve.description).toBeNull();
    expect(curve.intervals).toHaveLength(3);
    const events = curve.getDomainEvents();
    expect(events).toEqual([
      expect.any(CurveValuesChanged),
      expect.any(CurveDetailsChanged),
    ]);
    for (const event of events) {
      expect(event).toMatchObject({ aggregateId: curve.id, occurredAt: LATER });
    }
  });

  it.each([{ name: 'Otimista' }, { description: null }])(
    'keeps the values revision and raises a details event for %o',
    (edit) => {
      const curve = restore(create().value);
      expect(curve.edit(edit, LATER).isOk()).toBe(true);
      expect(curve.revision).toBe(2);
      expect(curve.valuesRevision).toBe(1);
      expect(curve.getDomainEvents()).toEqual([
        expect.any(CurveDetailsChanged),
      ]);
    },
  );

  it.each([
    { intervals: [interval('2026-10-01', '2026-10-31', '0.11')] },
    {
      intervals: [
        interval('2026-10-01', '2026-10-15'),
        interval('2026-10-16', '2026-10-31'),
      ],
    },
  ])(
    'raises the values revision and a values event for new intervals %#',
    (edit) => {
      const curve = restore(create().value);
      expect(curve.edit(edit, LATER).isOk()).toBe(true);
      expect(curve.revision).toBe(2);
      expect(curve.valuesRevision).toBe(2);
      expect(curve.getDomainEvents()).toEqual([expect.any(CurveValuesChanged)]);
    },
  );

  it.each([
    {},
    {
      name: ' CDI base ',
      description: 'Cenário base',
      intervals: [interval('2026-10-01', '2026-10-31', '0.120')],
    },
  ])(
    'keeps the revision and raises nothing for an empty or identical edit',
    (edit) => {
      const curve = restore(create().value);
      expect(curve.edit(edit, LATER).isOk()).toBe(true);
      expect(curve.revision).toBe(1);
      expect(curve.getDomainEvents()).toEqual([]);
    },
  );

  it('rejects an invalid edit without changing anything', () => {
    const curve = restore(create().value);
    const result = curve.edit({ intervals: [] }, LATER);
    expect(result.error).toBeInstanceOf(InvalidCurveError);
    expect(curve.intervals).toHaveLength(1);
    expect(curve.revision).toBe(1);
    expect(curve.getDomainEvents()).toEqual([]);
  });

  it('gives all changes before a save one revision, and a new one after it', () => {
    const fresh = create().value;
    fresh.edit({ name: 'Renomeada' }, AT);
    expect(fresh.revision).toBe(1);

    const curve = restore(fresh);
    curve.edit({ name: 'CDI otimista' }, AT);
    curve.delete(LATER);
    expect(curve.revision).toBe(2);

    curve.markPersisted().edit({ name: 'CDI base' }, LATER);
    expect(curve.revision).toBe(3);
  });

  it('gives all values changes before a save one values revision, and a new one after it', () => {
    const curve = restore(create().value);
    curve.edit(
      { intervals: [interval('2026-10-01', '2026-10-31', '0.11')] },
      AT,
    );
    curve.edit(
      { intervals: [interval('2026-10-01', '2026-10-31', '0.10')] },
      AT,
    );
    expect(curve.valuesRevision).toBe(2);

    curve
      .markPersisted()
      .edit(
        { intervals: [interval('2026-10-01', '2026-10-31', '0.09')] },
        LATER,
      );
    expect(curve.valuesRevision).toBe(3);
  });

  it('deletes once, incrementing the revision and preserving its content', () => {
    const curve = restore(create().value);
    expect(curve.delete(AT)).toBe(curve);
    curve.delete(LATER);
    expect(curve.deletedAt).toBe(AT);
    expect(curve.revision).toBe(2);
    expect(curve.valuesRevision).toBe(1);
    expect(curve.intervals).toHaveLength(1);
    const events = curve.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CurveDeleted);
    expect(events[0]).toMatchObject({ aggregateId: curve.id, occurredAt: AT });
  });

  it('copies and orders input intervals and returns defensive collections', () => {
    const later = interval('2026-10-08', '2026-10-31', '0.11');
    const earlier = interval('2026-10-01', '2026-10-07');
    const input = [later, earlier];
    const curve = create({ intervals: input }).value;
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
      const curve = create().value;
      expect(
        curve
          .valueAt(CalendarDate.of(reference))
          .value.equals(IndexValue.of('0.12')),
      ).toBe(true);
    },
  );

  it.each(['2026-09-30', '2026-11-01'])(
    'reports absence at %s outside the covered span',
    (reference) => {
      const curve = create().value;
      const result = curve.valueAt(CalendarDate.of(reference));
      expect(result.error.code).toBe(EAppErrorCode.CURVE_VALUE_NOT_FOUND);
      expect(result.error.metadata).toEqual({
        curveId: curve.id,
        reference,
      });
    },
  );

  it('accepts a point interval with explicit zero for CDI and SELIC', () => {
    for (const index of [EEconomicIndex.CDI, EEconomicIndex.SELIC]) {
      const curve = create({
        index,
        intervals: [interval('2026-10-05', '2026-10-05', '0')],
      }).value;
      expect(
        curve.valueAt(CalendarDate.of('2026-10-05')).value.value.isZero(),
      ).toBe(true);
    }
  });

  it.each<Partial<CreateCurveProps>>([
    { name: '   ' },
    { intervals: [] },
    { intervals: [interval('2026-10-01', '2026-10-31', '-0.01')] },
    {
      index: EEconomicIndex.SELIC,
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
    const result = create(overrides);
    expect(result.error).toBeInstanceOf(InvalidCurveError);
    expect(result.error.code).toBe(EAppErrorCode.INVALID_CURVE);
  });

  it.each([
    [
      'a business day',
      [
        interval('2026-10-01', '2026-10-06'),
        interval('2026-10-08', '2026-10-31'),
      ],
      { start: '2026-10-07', end: '2026-10-07' },
    ],
    [
      'business days around a weekend, reported from the first to the last',
      [
        interval('2026-10-01', '2026-10-02'),
        interval('2026-10-08', '2026-10-31'),
      ],
      { start: '2026-10-05', end: '2026-10-07' },
    ],
  ])('rejects a curve missing %s', (_, intervals, missing) => {
    const result = create({ intervals });
    expect(result.error.code).toBe(EAppErrorCode.CURVE_INTERVAL_GAP);
    expect(result.error.metadata).toEqual(missing);
  });

  it('accepts uncovered weekends and holidays between intervals', () => {
    // 10-10 and 10-11 are a weekend; 10-12 is a national holiday.
    const result = create({
      intervals: [
        interval('2026-10-01', '2026-10-09'),
        interval('2026-10-13', '2026-10-31', '0.11'),
      ],
    });
    expect(result.isOk()).toBe(true);
  });

  it('rejects a monthly curve missing a month', () => {
    const result = create({
      index: EEconomicIndex.IPCA,
      intervals: [
        interval('2027-01-01', '2027-01-31', '0.004'),
        interval('2027-03-01', '2027-03-31', '0.003'),
      ],
    });
    expect(result.error.code).toBe(EAppErrorCode.CURVE_INTERVAL_GAP);
    expect(result.error.metadata).toEqual({
      start: '2027-02-01',
      end: '2027-02-28',
    });
  });

  it('rejects an edit that leaves a gap without changing anything', () => {
    const curve = create().value.markPersisted();
    const result = curve.edit(
      {
        intervals: [
          interval('2026-10-01', '2026-10-06'),
          interval('2026-10-08', '2026-10-31'),
        ],
      },
      LATER,
    );
    expect(result.error.code).toBe(EAppErrorCode.CURVE_INTERVAL_GAP);
    expect(curve.revision).toBe(1);
    expect(curve.intervals).toEqual([interval('2026-10-01', '2026-10-31')]);
  });

  it('resolves monthly inflation, deflation and repeated monthly values', () => {
    const curve = create({
      index: EEconomicIndex.IPCA,
      intervals: [
        interval('2024-02-01', '2024-02-29', '-0.004'),
        interval('2024-03-01', '2024-04-30', '0.003'),
      ],
    }).value;
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
      create({
        index: EEconomicIndex.IPCA,
        intervals: [interval(start, end)],
      }).isErr(),
    ).toBe(true);
  });

  it('resolves many references in order or reports every uncovered one', () => {
    const curve = create({
      intervals: [
        interval('2026-10-01', '2026-10-02', '0.10'),
        interval('2026-10-05', '2026-10-05', '0.11'),
      ],
    }).value;
    const dates = (...isos: string[]) =>
      isos.map((iso) => CalendarDate.of(iso));

    expect(
      curve
        .valuesAt(dates('2026-10-02', '2026-10-05', '2026-10-01'))
        .value.map((value: IndexValue) => value.value.toString()),
    ).toEqual(['0.1', '0.11', '0.1']);
    const missing = curve.valuesAt(
      dates('2026-10-02', '2026-10-03', '2026-10-06'),
    );
    expect(missing.error.code).toBe(EAppErrorCode.CURVE_COVERAGE_MISSING);
    // Adjacent in the request, so one gap from the first to the last.
    expect(missing.error.metadata?.['missingRanges']).toEqual([
      { start: '2026-10-03', end: '2026-10-06' },
    ]);
  });

  it('groups consecutive missing references into ranges', () => {
    const curve = create({
      intervals: [
        interval('2026-10-05', '2026-10-06', '0.10'),
        interval('2026-10-07', '2026-10-09', '0.11'),
      ],
    }).value;
    const references = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-13',
    ].map((iso) => CalendarDate.of(iso));

    const error = curve.valuesAt(references).error;
    expect(error.metadata?.['missingRanges']).toEqual([
      { start: '2026-10-01', end: '2026-10-02' },
      { start: '2026-10-13', end: '2026-10-13' },
    ]);
    expect(error.metadata?.['curveId']).toBe(curve.id);
  });
});
