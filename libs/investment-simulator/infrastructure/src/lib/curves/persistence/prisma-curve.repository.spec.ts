import {
  Curve,
  CurveInterval,
  EEconomicIndex,
  IndexValue,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  DomainEventRecorder,
  EAppErrorCode,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  PrismaService,
  RepositoryFindError,
} from '@investflow/shared-infrastructure';
import { EconomicIndex as DbIndex, Prisma } from '@prisma/client';
import { CurveRecord } from './curve.mapper';
import { PrismaCurveRepository } from './prisma-curve.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const AT = UtcInstant.ofIso('2026-10-11T12:00:00Z');

function fixture() {
  const curve = {
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const interval = { deleteMany: jest.fn(), createMany: jest.fn() };
  const events = { record: jest.fn() };
  return {
    curve,
    interval,
    events,
    repository: new PrismaCurveRepository(
      {
        client: { curve, curveInterval: interval },
      } as unknown as PrismaService,
      events as unknown as DomainEventRecorder,
    ),
  };
}

function record(value = '0.12'): CurveRecord {
  return {
    id: ID,
    ownerId: 'user-id',
    index: DbIndex.SELIC,
    name: 'SELIC',
    description: null,
    revision: 3,
    deletedAt: null,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    updatedAt: new Date('2026-10-01T12:00:00Z'),
    intervals: [
      {
        curveId: ID,
        startDate: new Date('2026-10-01T00:00:00Z'),
        endDate: new Date('2026-10-31T00:00:00Z'),
        value: new Prisma.Decimal(value),
      },
    ],
  };
}

function interval(value: string) {
  return CurveInterval.create(
    CalendarDateRange.of(
      CalendarDate.of('2026-10-01'),
      CalendarDate.of('2026-10-31'),
    ),
    IndexValue.of(value),
  );
}

describe('PrismaCurveRepository', () => {
  it('loads an active curve with its index and all decimal digits', async () => {
    const test = fixture();
    test.curve.findUnique.mockResolvedValue(
      record('0.123456789012345678901234567891'),
    );

    const curve = (await test.repository.findById(ID)).value;

    expect(test.curve.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID, deletedAt: null } }),
    );
    expect(curve.index).toBe(EEconomicIndex.SELIC);
    expect(curve.revision).toBe(3);
    expect(curve.intervals[0].value.value.toString()).toBe(
      '0.123456789012345678901234567891',
    );
  });

  it('reports a missing curve and wraps read failures', async () => {
    const missing = fixture();
    missing.curve.findUnique.mockResolvedValue(null);
    const failing = fixture();
    failing.curve.findUnique.mockRejectedValue(new Error('read'));

    expect((await missing.repository.findById(ID)).error.code).toBe(
      EAppErrorCode.CURVE_NOT_FOUND,
    );
    expect((await failing.repository.findById(ID)).error).toBeInstanceOf(
      RepositoryFindError,
    );
  });

  it('inserts a new curve with its intervals', async () => {
    const test = fixture();
    const curve = Curve.create(
      {
        index: EEconomicIndex.CDI,
        ownerId: null,
        name: 'CDI',
        intervals: [interval('0.12')],
      },
      AT,
    ).value;

    expect((await test.repository.save(curve)).isOk()).toBe(true);

    expect(test.curve.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: curve.id, revision: 1 }),
    });
    expect(test.interval.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ curveId: curve.id, value: '0.12' })],
    });
    expect(test.curve.updateMany).not.toHaveBeenCalled();
    expect(test.events.record).toHaveBeenCalledTimes(1);
  });

  it('updates from the revision it read and replaces the intervals', async () => {
    const test = fixture();
    test.curve.findUnique.mockResolvedValue(record());
    const curve = (await test.repository.findById(ID)).value;
    curve.edit({ intervals: [interval('0.11')] }, AT);

    expect((await test.repository.save(curve)).isOk()).toBe(true);

    expect(test.curve.updateMany).toHaveBeenCalledWith({
      where: { id: ID, revision: 3 },
      data: expect.objectContaining({ revision: 4 }),
    });
    expect(test.interval.deleteMany).toHaveBeenCalledWith({
      where: { curveId: ID },
    });
    expect(test.interval.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ value: '0.11' })],
    });
    expect(test.curve.create).not.toHaveBeenCalled();
  });

  it('writes nothing for an unchanged curve', async () => {
    const test = fixture();
    test.curve.findUnique.mockResolvedValue(record());
    const curve = (await test.repository.findById(ID)).value;

    expect((await test.repository.save(curve)).isOk()).toBe(true);

    expect(test.curve.updateMany).not.toHaveBeenCalled();
    expect(test.interval.createMany).not.toHaveBeenCalled();
  });

  it('reports a conflict when another writer changed the revision', async () => {
    const test = fixture();
    test.curve.findUnique.mockResolvedValue(record());
    test.curve.updateMany.mockResolvedValue({ count: 0 });
    const curve = (await test.repository.findById(ID)).value;
    curve.edit({ name: 'SELIC otimista' }, AT);

    const result = await test.repository.save(curve);

    expect(result.error.code).toBe(EAppErrorCode.CURVE_REVISION_CONFLICT);
    expect(result.error.kind).toBe('conflict');
    expect(test.interval.deleteMany).not.toHaveBeenCalled();
    expect(test.events.record).not.toHaveBeenCalled();
  });

  it.each(['0.1234567890123456789012345678901', '1e35'])(
    'rejects unrepresentable value %s before writing',
    async (value) => {
      const test = fixture();
      test.curve.findUnique.mockResolvedValue(record());
      const curve = (await test.repository.findById(ID)).value;
      curve.edit({ intervals: [interval(value)] }, AT);

      const result = await test.repository.save(curve);

      expect(result.error.code).toBe(
        EAppErrorCode.CURVE_VALUE_NOT_REPRESENTABLE,
      );
      expect(result.error.kind).toBe('validation');
      expect(test.curve.updateMany).not.toHaveBeenCalled();
    },
  );
});
