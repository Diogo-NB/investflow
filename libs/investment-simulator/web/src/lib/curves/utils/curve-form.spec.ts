import { businessCalendar } from '../../business-calendar/business-calendar';
import type { CurveDetail } from '../models/curve.types';
import {
  blankRow,
  boundaryLimits,
  changesCurveValues,
  curveEdit,
  curveFormSchema,
  curveValues,
  followEnd,
  followStart,
  hasRowContent,
  isNonBusinessDate,
  nextRow,
  removalPatch,
  rowsCoverage,
  splitRow,
  startFix,
  toCurveInput,
  type CurveFormValues,
} from './curve-form';

// The holidays these tests cross; weekends need no listing.
const calendar = businessCalendar({
  fromYear: 1926,
  toYear: 2126,
  holidays: ['2026-10-12', '2026-11-02', '2026-12-25', '2027-01-01'],
});

const cdi: CurveDetail = {
  id: 'curve',
  index: 'CDI',
  name: 'CDI base',
  description: 'Cenário base',
  origin: 'OWN',
  revision: 3,
  intervals: [
    { startDate: '2026-10-01', endDate: '2026-10-30', value: '0.12' },
    { startDate: '2026-11-03', endDate: '2026-11-30', value: '0.115' },
  ],
};

const ipca: CurveDetail = {
  ...cdi,
  index: 'IPCA',
  name: 'IPCA base',
  intervals: [
    { startDate: '2027-01-01', endDate: '2027-03-31', value: '0.004' },
    { startDate: '2027-04-01', endDate: '2027-04-30', value: '-0.0025' },
  ],
};

function issues(values: CurveFormValues) {
  const result = curveFormSchema(calendar).safeParse(values);
  return (result.error?.issues ?? []).map((issue) => ({
    path: issue.path,
    message: issue.message,
  }));
}

describe('curve form values', () => {
  it('types rates as percentages and IPCA intervals as months', () => {
    expect(curveValues(cdi).intervals).toEqual([
      { start: '2026-10-01', end: '2026-10-30', value: '12' },
      { start: '2026-11-03', end: '2026-11-30', value: '11,5' },
    ]);
    expect(curveValues(ipca).intervals).toEqual([
      { start: '01/2027', end: '03/2027', value: '0,4' },
      { start: '04/2027', end: '04/2027', value: '-0,25' },
    ]);
  });

  it('converts back to the same content, sorted by start', () => {
    const values = curveValues(ipca);
    expect(
      toCurveInput({ ...values, intervals: [...values.intervals].reverse() }),
    ).toEqual({
      index: 'IPCA',
      name: 'IPCA base',
      description: 'Cenário base',
      intervals: ipca.intervals,
    });
  });
});

describe('curveEdit', () => {
  it('sends only the changed fields with the edited revision', () => {
    const values = curveValues(cdi);
    expect(
      curveEdit(cdi, {
        ...values,
        description: '  ',
        intervals: [
          values.intervals[0],
          { ...values.intervals[1], value: '11' },
        ],
      }),
    ).toEqual({
      revision: 3,
      description: null,
      intervals: [
        cdi.intervals[0],
        { startDate: '2026-11-03', endDate: '2026-11-30', value: '0.11' },
      ],
    });
  });

  it('treats values typed differently or reordered as unchanged', () => {
    const values = curveValues(cdi);
    expect(
      curveEdit(cdi, {
        ...values,
        name: 'CDI base ',
        intervals: [
          { ...values.intervals[1], value: '11,50' },
          values.intervals[0],
        ],
      }),
    ).toEqual({ revision: 3 });
  });
});

describe('changesCurveValues', () => {
  it('is false for the name and description, or intervals retyped equally', () => {
    const values = curveValues(cdi);
    expect(
      changesCurveValues(cdi, {
        ...values,
        name: 'Outro nome',
        description: 'Outra descrição',
        intervals: [
          { ...values.intervals[1], value: '11,50' },
          values.intervals[0],
        ],
      }),
    ).toBe(false);
  });

  it('is true when an interval changes or is not valid yet', () => {
    const values = curveValues(cdi);
    expect(
      changesCurveValues(cdi, {
        ...values,
        intervals: [
          values.intervals[0],
          { ...values.intervals[1], value: '11' },
        ],
      }),
    ).toBe(true);
    expect(
      changesCurveValues(cdi, {
        ...values,
        intervals: [values.intervals[0], { ...values.intervals[1], value: '' }],
      }),
    ).toBe(true);
  });
});

describe('curveFormSchema', () => {
  it('accepts intervals separated only by weekends and holidays', () => {
    // 10-31 and 11-01 are a weekend, 11-02 a holiday.
    expect(issues(curveValues(cdi))).toEqual([]);
  });

  it('reports missing business days on the later interval', () => {
    const values = curveValues(cdi);
    expect(
      issues({
        ...values,
        intervals: [
          { ...values.intervals[0], end: '2026-10-28' },
          values.intervals[1],
        ],
      }),
    ).toEqual([
      {
        path: ['intervals', 1, 'start'],
        message: 'Faltam valores de 29/10/2026 a 30/10/2026.',
      },
    ]);
  });

  it('reports a missing month for monthly indexes', () => {
    const values = curveValues(ipca);
    expect(
      issues({
        ...values,
        intervals: [
          { ...values.intervals[0], end: '02/2027' },
          values.intervals[1],
        ],
      }),
    ).toEqual([
      {
        path: ['intervals', 1, 'start'],
        message: 'Faltam valores de 01/03/2027 a 31/03/2027.',
      },
    ]);
  });

  it('rejects dates outside the accepted years', () => {
    expect(
      issues({
        ...curveValues(cdi),
        intervals: [{ start: '1925-12-31', end: '2127-01-04', value: '12' }],
      }),
    ).toEqual([
      {
        path: ['intervals', 0, 'start'],
        message: 'Use datas entre 01/01/1926 e 31/12/2126.',
      },
      {
        path: ['intervals', 0, 'end'],
        message: 'Use datas entre 01/01/1926 e 31/12/2126.',
      },
    ]);
  });

  it('reports each invalid field of a row', () => {
    expect(
      issues({
        ...curveValues(cdi),
        intervals: [
          { start: '', end: '31/02/2026', value: '12' },
          { start: '2026-12-10', end: '2026-12-01', value: '-1' },
          { start: '2027-01-04', end: '2027-01-29', value: 'doze' },
        ],
      }),
    ).toEqual([
      { path: ['intervals', 0, 'start'], message: 'Informe a data.' },
      {
        path: ['intervals', 0, 'end'],
        message: 'Informe uma data válida no formato DD/MM/AAAA.',
      },
      {
        path: ['intervals', 1, 'end'],
        message: 'O fim deve ser igual ou posterior ao início.',
      },
      {
        path: ['intervals', 1, 'value'],
        message: 'As taxas não podem ser negativas.',
      },
      {
        path: ['intervals', 2, 'value'],
        message: 'Use apenas números, como 12,5.',
      },
    ]);
  });

  it('reports an overlap on the later interval', () => {
    const values = curveValues(cdi);
    expect(
      issues({
        ...values,
        intervals: [
          { ...values.intervals[1], start: '2026-10-30' },
          values.intervals[0],
        ],
      }),
    ).toEqual([
      {
        path: ['intervals', 0, 'start'],
        message: 'Este intervalo se sobrepõe a outro.',
      },
    ]);
  });

  it('allows negative monthly variations above -100%', () => {
    const values = curveValues(ipca);
    const row = values.intervals[1];
    expect(
      issues({ ...values, intervals: [{ ...row, value: '-99,9' }] }),
    ).toEqual([]);
    expect(
      issues({ ...values, intervals: [{ ...row, value: '-100' }] }),
    ).toEqual([
      {
        path: ['intervals', 0, 'value'],
        message: 'A variação deve ser maior que -100%.',
      },
    ]);
    expect(
      issues({ ...values, intervals: [{ ...row, start: '13/2027' }] }),
    ).toEqual([
      {
        path: ['intervals', 0, 'start'],
        message: 'Informe um mês válido no formato MM/AAAA.',
      },
    ]);
  });

  it('requires an index, a name, and at least one interval', () => {
    expect(
      issues({
        index: '',
        name: 'X',
        description: '',
        intervals: [blankRow()],
      }),
    ).toEqual([{ path: ['index'], message: 'Escolha o índice.' }]);
    expect(issues({ ...curveValues(cdi), name: ' ', intervals: [] })).toEqual([
      { path: ['name'], message: 'Informe o nome da curva.' },
      { path: ['intervals'], message: 'Informe ao menos um intervalo.' },
    ]);
  });
});

describe('row operations', () => {
  const rows = curveValues(cdi).intervals;

  it('starts the next row on the business day after a changed end', () => {
    const extended = [{ ...rows[0], end: '2026-11-13' }, rows[1]];
    expect(followEnd('CDI', extended, 0, calendar)).toEqual({
      row: 1,
      field: 'start',
      value: '2026-11-16',
    });
    const shortened = [{ ...rows[0], end: '2026-10-09' }, rows[1]];
    // 10-12 is a holiday.
    expect(followEnd('CDI', shortened, 0, calendar)?.value).toBe('2026-10-13');
    expect(followEnd('CDI', rows, 0, calendar)).toBeNull();
    expect(followEnd('CDI', rows, 1, calendar)).toBeNull();
  });

  it('ends the previous row on the business day before a changed start', () => {
    const moved = [rows[0], { ...rows[1], start: '2026-10-13' }];
    expect(followStart('CDI', moved, 1, calendar)).toEqual({
      row: 0,
      field: 'end',
      value: '2026-10-09',
    });
    expect(followStart('CDI', rows, 0, calendar)).toBeNull();
  });

  it('follows months for monthly indexes', () => {
    const months = curveValues(ipca).intervals;
    expect(
      followEnd(
        'IPCA',
        [{ ...months[0], end: '05/2027' }, months[1]],
        0,
        calendar,
      ),
    ).toEqual({ row: 1, field: 'start', value: '06/2027' });
    expect(
      followStart(
        'IPCA',
        [months[0], { ...months[1], start: '02/2027' }],
        1,
        calendar,
      ),
    ).toEqual({ row: 0, field: 'end', value: '01/2027' });
  });

  it('does not follow a boundary still being typed', () => {
    expect(
      followEnd('CDI', [{ ...rows[0], end: '15/11/20' }, rows[1]], 0, calendar),
    ).toBeNull();
  });

  it('closes the hole of a removed middle row with the previous row', () => {
    const three = [
      rows[0],
      { start: '2026-11-03', end: '2026-11-13', value: '11' },
      { start: '2026-11-16', end: '2026-11-30', value: '10' },
    ];
    expect(removalPatch('CDI', three, 1, calendar)).toEqual({
      row: 0,
      field: 'end',
      value: '2026-11-13',
    });
    // Even when the removed row's own dates are unusable.
    const typing = [three[0], { start: 'x', end: '', value: '' }, three[2]];
    expect(removalPatch('CDI', typing, 1, calendar)?.value).toBe('2026-11-13');
  });

  it('shortens the curve when the first or last row is removed', () => {
    expect(removalPatch('CDI', rows, 0, calendar)).toBeNull();
    expect(removalPatch('CDI', rows, 1, calendar)).toBeNull();
  });

  it('splits a row at the month start nearest its middle', () => {
    expect(
      splitRow(
        'CDI',
        { start: '2026-10-01', end: '2026-12-31', value: '12' },
        calendar,
      ),
    ).toEqual([
      { start: '2026-10-01', end: '2026-10-30', value: '12' },
      { start: '2026-11-03', end: '2026-12-31', value: '12' },
    ]);
  });

  it('splits a row within one month at its middle business day', () => {
    expect(splitRow('CDI', rows[0], calendar)).toEqual([
      // 21 business days (10-12 is a holiday): 10 before the middle one.
      { start: '2026-10-01', end: '2026-10-15', value: '12' },
      { start: '2026-10-16', end: '2026-10-30', value: '12' },
    ]);
  });

  it('splits monthly rows by month, and not single days or months', () => {
    expect(
      splitRow(
        'IPCA',
        { start: '01/2027', end: '03/2027', value: '0,4' },
        calendar,
      ),
    ).toEqual([
      { start: '01/2027', end: '01/2027', value: '0,4' },
      { start: '02/2027', end: '03/2027', value: '0,4' },
    ]);
    expect(
      splitRow(
        'IPCA',
        { start: '01/2027', end: '01/2027', value: '' },
        calendar,
      ),
    ).toBeNull();
    expect(
      splitRow(
        'CDI',
        { start: '2026-10-05', end: '2026-10-05', value: '' },
        calendar,
      ),
    ).toBeNull();
  });

  it('suggests the start that closes a gap or overlap', () => {
    const gap = [rows[0], { ...rows[1], start: '2026-11-10' }];
    expect(startFix('CDI', gap, 1, calendar)).toBe('2026-11-03');
    const overlap = [rows[0], { ...rows[1], start: '2026-10-20' }];
    expect(startFix('CDI', overlap, 1, calendar)).toBe('2026-11-03');
    expect(startFix('CDI', rows, 1, calendar)).toBeNull();
    expect(startFix('CDI', rows, 0, calendar)).toBeNull();
    // Starting after the previous end would pass the row's own end.
    const short = [
      rows[0],
      { start: '2026-10-20', end: '2026-10-22', value: '' },
    ];
    expect(startFix('CDI', short, 1, calendar)).toBeNull();
  });

  it('flags typed weekends and holidays on daily rows only', () => {
    expect(isNonBusinessDate('CDI', '2026-10-12', calendar)).toBe(true);
    expect(isNonBusinessDate('CDI', '2026-10-13', calendar)).toBe(false);
    expect(isNonBusinessDate('CDI', '2031-01-04', calendar)).toBe(true);
    expect(isNonBusinessDate('CDI', '2031-01-06', calendar)).toBe(false);
    expect(isNonBusinessDate('IPCA', '10/2026', calendar)).toBe(false);
  });

  it('knows whether any row has content', () => {
    expect(hasRowContent([blankRow(), { ...blankRow(), value: ' ' }])).toBe(
      false,
    );
    expect(hasRowContent([blankRow(), { ...blankRow(), value: '1' }])).toBe(
      true,
    );
  });

  it('limits a start to after the previous start and up to its own end', () => {
    expect(boundaryLimits(rows, 1, 'start')).toEqual({
      min: '2026-10-02',
      max: '2026-11-30',
    });
    expect(boundaryLimits(rows, 0, 'start')).toEqual({
      min: undefined,
      max: '2026-10-30',
    });
  });

  it('limits an end to its own start and before the next end', () => {
    expect(boundaryLimits(rows, 0, 'end')).toEqual({
      min: '2026-10-01',
      max: '2026-11-29',
    });
    expect(boundaryLimits(rows, 1, 'end')).toEqual({
      min: '2026-11-03',
      max: undefined,
    });
    // A start typed as 02/01/2029 limits its end before the end is set.
    expect(
      boundaryLimits([{ start: '2029-01-02', end: '', value: '' }], 0, 'end'),
    ).toEqual({ min: '2029-01-02', max: undefined });
  });

  it("keeps the row's own boundary when neighbors disagree", () => {
    const broken = [rows[0], { ...rows[1], end: '2026-09-30' }];
    expect(boundaryLimits(broken, 0, 'end')).toEqual({ min: '2026-10-01' });
    const late = [
      rows[0],
      { ...rows[1], start: '2026-09-01', end: '2026-09-30' },
    ];
    expect(boundaryLimits(late, 1, 'start')).toEqual({ max: '2026-09-30' });
  });

  it('starts a new row after the last one, ending with that month', () => {
    // 12-25 is a holiday and 12-31 a Thursday.
    expect(nextRow('CDI', rows, calendar)).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
      value: '',
    });
    expect(nextRow('IPCA', curveValues(ipca).intervals, calendar)).toEqual({
      start: '05/2027',
      end: '05/2027',
      value: '',
    });
    expect(nextRow('CDI', [blankRow()], calendar).start).toBe('');
  });
});

describe('rowsCoverage', () => {
  it('spans the rows with valid dates', () => {
    expect(rowsCoverage('CDI', curveValues(cdi).intervals)).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-11-30',
    });
    expect(rowsCoverage('IPCA', curveValues(ipca).intervals)).toEqual({
      startDate: '2027-01-01',
      endDate: '2027-04-30',
    });
    expect(rowsCoverage('CDI', [blankRow()])).toBeNull();
  });
});
