import {
  EEconomicIndex,
  IndexCurve,
  IndexCurveInterval,
  IndexValue,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  PrismaService,
  RepositoryFindError,
  RepositorySaveError,
} from '@investflow/shared-infrastructure';
import { EconomicIndex as DbIndex, Prisma } from '@prisma/client';
import { IndexCurveRecord } from './index-curve.mapper';
import { PrismaIndexCurveRepository } from './prisma-index-curve.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';

function fixture() {
  const findUnique = jest.fn();
  const upsert = jest.fn().mockResolvedValue(undefined);
  const createMany = jest.fn();
  return {
    findUnique,
    upsert,
    createMany,
    repository: new PrismaIndexCurveRepository({
      client: {
        indexCurve: { findUnique, upsert },
        outboxEvent: { createMany },
      },
    } as unknown as PrismaService),
  };
}

function record(): IndexCurveRecord {
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
        value: new Prisma.Decimal('0.12'),
      },
    ],
  };
}

function curve(value = '0.12'): IndexCurve {
  return IndexCurve.reconstitute({
    id: ID,
    name: 'CDI base',
    description: null,
    index: EEconomicIndex.CDI,
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

describe('PrismaIndexCurveRepository', () => {
  it('loads the full aggregate with chronologically ordered intervals', async () => {
    const test = fixture();
    test.findUnique.mockResolvedValue(record());
    const result = await test.repository.findById(ID);
    expect(result.isOk()).toBe(true);
    expect(result.value.id).toBe(ID);
    expect(test.findUnique).toHaveBeenCalledWith({
      where: { id: ID, deletedAt: null },
      include: { intervals: { orderBy: { startDate: 'asc' } } },
    });
  });

  it('returns the application not-found error for an absent or deleted curve', async () => {
    const test = fixture();
    test.findUnique.mockResolvedValue(null);
    const result = await test.repository.findById(ID);
    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe(EAppErrorCode.INDEX_CURVE_NOT_FOUND);
    expect(result.error.kind).toBe('not-found');
    expect(result.error.metadata).toEqual({ curveId: ID });
  });

  it('captures read and mapper failures', async () => {
    const read = fixture();
    read.findUnique.mockRejectedValue(new Error('read failed'));
    const mapping = fixture();
    const invalidRecord = record();
    invalidRecord.intervals[0].value = new Prisma.Decimal(-1);
    mapping.findUnique.mockResolvedValue(invalidRecord);
    for (const result of await Promise.all([
      read.repository.findById(ID),
      mapping.repository.findById(ID),
    ])) {
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(RepositoryFindError);
    }
  });

  it('upserts the entire curve and preserves existing content for active saves', async () => {
    const test = fixture();
    expect((await test.repository.save(curve())).isOk()).toBe(true);
    expect(test.upsert).toHaveBeenCalledWith({
      where: { id: ID },
      create: {
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
              value: '0.12',
            },
          ],
        },
      },
      update: {},
    });
    expect(test.findUnique).not.toHaveBeenCalled();
    expect(test.createMany).not.toHaveBeenCalled();
  });

  it('saves only the deletion instant and preserves immutable fields', async () => {
    const test = fixture();
    const at = UtcInstant.ofIso('2026-10-04T12:00:00Z');
    expect((await test.repository.save(curve().delete(at))).isOk()).toBe(true);
    expect(test.upsert).toHaveBeenCalledWith({
      where: { id: ID },
      create: expect.objectContaining({ id: ID, deletedAt: at.date }),
      update: { deletedAt: at.date },
    });
    expect(test.createMany).not.toHaveBeenCalled();
    test.findUnique.mockResolvedValue(null);
    const result = await test.repository.findById(ID);
    expect(result.error.code).toBe(EAppErrorCode.INDEX_CURVE_NOT_FOUND);
  });

  it('wraps deletion write errors', async () => {
    const test = fixture();
    const cause = new Error('update failed');
    test.upsert.mockRejectedValue(cause);
    const result = await test.repository.save(
      curve().delete(UtcInstant.ofIso('2026-10-04T12:00:00Z')),
    );
    expect(result.error).toBeInstanceOf(RepositorySaveError);
    expect(result.error.cause).toBe(cause);
  });

  it('wraps persistence errors', async () => {
    const test = fixture();
    const cause = new Error('upsert failed');
    test.upsert.mockRejectedValue(cause);
    const result = await test.repository.save(curve());
    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(RepositorySaveError);
    expect(result.error.cause).toBe(cause);
    expect(test.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects excessive precision before sending any database write', async () => {
    const test = fixture();
    const result = await test.repository.save(
      curve('0.1234567890123456789012345678901'),
    );
    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(RepositorySaveError);
    expect(test.upsert).not.toHaveBeenCalled();
  });
});
