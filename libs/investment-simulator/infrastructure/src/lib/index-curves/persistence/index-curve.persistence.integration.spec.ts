import { ConfigService } from '@nestjs/config';
import {
  EconomicIndex,
  IndexCurve,
  IndexCurveInterval,
  IndexValue,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { PrismaIndexCurveRepository } from './prisma-index-curve.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

// Run against an isolated database with the migrations already applied.
const connectionString = process.env['INDEX_CURVE_TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

integration('Index curve PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let repository: PrismaIndexCurveRepository;
  const ids: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: connectionString }),
    );
    await prisma.onModuleInit();
    repository = new PrismaIndexCurveRepository(prisma);
  });

  afterAll(async () => {
    try {
      await prisma.client.indexCurveInterval.deleteMany({
        where: { curveId: { in: ids } },
      });
      await prisma.client.indexCurve.deleteMany({ where: { id: { in: ids } } });
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  it.each([EconomicIndex.CDI, EconomicIndex.SELIC])(
    'round trips %s and saves repeatedly without changing the original content',
    async (index) => {
      const value = '0.123456789012345678901234567891';
      const curve = IndexCurve.create({
        name: 'Integration CDI',
        description: 'Preserved content',
        index,
        intervals: [
          IndexCurveInterval.create(
            CalendarDateRange.of(
              CalendarDate.of('2026-10-05'),
              CalendarDate.of('2026-10-05'),
            ),
            IndexValue.of(value),
          ),
        ],
      }).value;
      ids.push(curve.id);
      expect((await repository.save(curve)).isOk()).toBe(true);
      expect((await repository.save(curve)).isOk()).toBe(true);
      const modified = IndexCurve.reconstitute({
        id: curve.id,
        name: 'Attempted replacement',
        description: curve.description,
        index: curve.index,
        deletedAt: curve.deletedAt,
        intervals: curve.intervals,
      });
      expect((await repository.save(modified)).isOk()).toBe(true);
      const loaded = await repository.findById(curve.id);
      expect(loaded.isOk()).toBe(true);
      expect(loaded.value.name).toBe(curve.name);
      expect(loaded.value.index).toBe(index);
      expect(loaded.value.convention).toBe(curve.convention);
      expect(loaded.value.description).toBe(curve.description);
      expect(loaded.value.intervals[0].equals(curve.intervals[0])).toBe(true);
      expect(
        loaded.value
          .valueAt(CalendarDate.of('2026-10-05'))
          .value.value.toString(),
      ).toBe(value);
      expect(
        await prisma.client.indexCurveInterval.count({
          where: { curveId: curve.id },
        }),
      ).toBe(1);

      const deletedAt = UtcInstant.ofIso('2026-10-04T12:34:56.789Z');
      curve.delete(deletedAt);
      expect((await repository.save(curve)).isOk()).toBe(true);
      expect((await repository.save(curve)).isOk()).toBe(true);
      const absent = await repository.findById(curve.id);
      expect(absent.error.code).toBe('INDEX_CURVE_NOT_FOUND');
      expect((await repository.save(modified)).isOk()).toBe(true);
      expect((await repository.findById(curve.id)).error.code).toBe(
        'INDEX_CURVE_NOT_FOUND',
      );
      const preserved = await prisma.client.indexCurve.findUniqueOrThrow({
        where: { id: curve.id },
        include: { intervals: true },
      });
      expect(preserved.deletedAt).toEqual(deletedAt.date);
      expect(preserved.name).toBe(curve.name);
      expect(preserved.description).toBe(curve.description);
      expect(preserved.intervals).toHaveLength(1);
      expect(preserved.intervals[0].value.toString()).toBe(value);
    },
  );

  it('round trips monthly deflation', async () => {
    const curve = IndexCurve.create({
      name: 'Integration IPCA',
      index: EconomicIndex.IPCA,
      intervals: [
        IndexCurveInterval.create(
          CalendarDateRange.of(
            CalendarDate.of('2024-02-01'),
            CalendarDate.of('2024-02-29'),
          ),
          IndexValue.of('-0.004'),
        ),
      ],
    }).value;
    ids.push(curve.id);
    expect((await repository.save(curve)).isOk()).toBe(true);
    const loaded = await repository.findById(curve.id);
    expect(loaded.isOk()).toBe(true);
    expect(loaded.value.convention).toBe(curve.convention);
    expect(
      loaded.value
        .valueAt(CalendarDate.of('2024-02-15'))
        .value.equals(IndexValue.of('-0.004')),
    ).toBe(true);
  });

  it('rolls back the entire nested insert when intervals have duplicate start dates', async () => {
    const id = generateUuid();
    ids.push(id);
    await expect(
      prisma.client.indexCurve.create({
        data: {
          id,
          name: 'Invalid nested insert',
          index: 'CDI',
          intervals: {
            create: [
              {
                startDate: new Date('2026-10-01T00:00:00Z'),
                endDate: new Date('2026-10-05T00:00:00Z'),
                value: '0.12',
              },
              {
                startDate: new Date('2026-10-01T00:00:00Z'),
                endDate: new Date('2026-10-31T00:00:00Z'),
                value: '0.12',
              },
            ],
          },
        },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.client.indexCurve.findUnique({ where: { id } }),
    ).toBeNull();
    expect(
      await prisma.client.indexCurveInterval.count({ where: { curveId: id } }),
    ).toBe(0);
  });
});
