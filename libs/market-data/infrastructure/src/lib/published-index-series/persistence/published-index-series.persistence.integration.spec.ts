import {
  EPublishedIndex,
  PublishedIndexSeries,
  PublishedIndexValue,
} from '@investflow/market-data-domain';
import { PublishedIndexSeriesNotFoundError } from '@investflow/market-data-application';
import { Clock } from '@investflow/shared-application';
import {
  CalendarDate,
  EAppErrorCode,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  PrismaService,
  TransactionalDomainEventRecorder,
  UnitOfWork,
} from '@investflow/shared-infrastructure';
import Decimal from 'decimal.js';
import { PrismaPublishedIndexSeriesRepository } from './prisma-published-index-series.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const connectionString = process.env['INTEGRATION_TEST_DATABASE_URL'];
if (!connectionString) {
  throw new Error(
    'INTEGRATION_TEST_DATABASE_URL is not set; run pnpm check:integration',
  );
}

const AT = UtcInstant.ofIso('2099-11-04T12:00:00Z');
const YEAR = 2099;

function published(date: string, value = '0.1365'): PublishedIndexValue {
  return PublishedIndexValue.of(CalendarDate.of(date), new Decimal(value));
}

describe('PublishedIndexSeries PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let unitOfWork: UnitOfWork;
  let repository: PrismaPublishedIndexSeriesRepository;
  const clock: Clock = {
    now: () => AT,
    today: () => CalendarDate.of('2099-11-04'),
  };

  async function clean(): Promise<void> {
    const series = await prisma.client.publishedIndexSeries.findMany({
      where: { year: { gte: YEAR } },
      select: { id: true },
    });
    const ids = series.map(({ id }) => id);
    await prisma.client.publishedIndexValue.deleteMany({
      where: { seriesId: { in: ids } },
    });
    await prisma.client.publishedIndexSeries.deleteMany({
      where: { id: { in: ids } },
    });
    await prisma.client.outboxEvent.deleteMany({
      where: { eventType: 'PublishedIndexValuesImported', occurredAt: AT.date },
    });
  }

  const save = (series: PublishedIndexSeries) =>
    unitOfWork.run(async () => {
      const saved = await repository.save(series);
      if (saved.isErr()) throw saved.error;
    });

  beforeAll(async () => {
    prisma = new PrismaService({ url: connectionString });
    unitOfWork = new UnitOfWork(prisma);
    await prisma.onModuleInit();
    repository = new PrismaPublishedIndexSeriesRepository(
      prisma,
      new TransactionalDomainEventRecorder(clock),
    );
  });

  beforeEach(clean);

  afterAll(async () => {
    try {
      await clean();
    } finally {
      await prisma.onApplicationShutdown();
    }
  });

  it('commits the values and their event together, and reads them back', async () => {
    const series = PublishedIndexSeries.create(EPublishedIndex.CDI, YEAR);
    series.append(
      [published('2099-11-03'), published('2099-11-04', '0.14')],
      AT,
    );

    await save(series);

    const found = await repository.findByIndexAndYear(
      EPublishedIndex.CDI,
      YEAR,
    );
    expect(found.value.id).toBe(series.id);
    expect(found.value.revision).toBe(1);
    expect(
      found.value.values.map(({ referenceDate, value }) => [
        referenceDate.toIsoString(),
        value.toFixed(),
      ]),
    ).toEqual([
      ['2099-11-03', '0.1365'],
      ['2099-11-04', '0.14'],
    ]);
    const [event] = await prisma.client.outboxEvent.findMany({
      where: { aggregateId: series.id },
    });
    expect(event.context).toBe('market-data');
    expect(event.payload).toMatchObject({
      index: 'CDI',
      values: [
        { referenceDate: '2099-11-03', value: '0.1365' },
        { referenceDate: '2099-11-04', value: '0.14' },
      ],
    });
  });

  it('rolls back the values and the event together', async () => {
    const series = PublishedIndexSeries.create(EPublishedIndex.CDI, YEAR);
    series.append([published('2099-11-03')], AT);

    await expect(
      unitOfWork.run(async () => {
        await repository.save(series);
        throw new Error('after the save');
      }),
    ).rejects.toThrow('after the save');

    const found = await repository.findByIndexAndYear(
      EPublishedIndex.CDI,
      YEAR,
    );
    expect(found.error).toBeInstanceOf(PublishedIndexSeriesNotFoundError);
    expect(
      await prisma.client.outboxEvent.count({
        where: { aggregateId: series.id },
      }),
    ).toBe(0);
  });

  it('appends only the new rows of a stored series', async () => {
    const created = PublishedIndexSeries.create(EPublishedIndex.SELIC, YEAR);
    created.append([published('2099-11-03')], AT);
    await save(created);
    const before = await prisma.client.publishedIndexValue.findFirstOrThrow({
      where: { seriesId: created.id },
    });

    const loaded = await repository.findByIndexAndYear(
      EPublishedIndex.SELIC,
      YEAR,
    );
    loaded.value.append([published('2099-11-04')], AT);
    await save(loaded.value);

    const rows = await prisma.client.publishedIndexValue.findMany({
      where: { seriesId: created.id },
      orderBy: { referenceDate: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(before);
    const reloaded = await repository.findById(created.id);
    expect(reloaded.value.revision).toBe(2);
    expect(
      await prisma.client.outboxEvent.count({
        where: { aggregateId: created.id },
      }),
    ).toBe(2);
  });

  it('rejects a save from a stale read, writing nothing', async () => {
    const created = PublishedIndexSeries.create(EPublishedIndex.CDI, YEAR);
    created.append([published('2099-11-03')], AT);
    await save(created);
    const first = await repository.findById(created.id);
    const stale = await repository.findById(created.id);

    first.value.append([published('2099-11-04')], AT);
    await save(first.value);
    stale.value.append([published('2099-11-05')], AT);

    await expect(save(stale.value)).rejects.toMatchObject({
      code: EAppErrorCode.PUBLISHED_INDEX_SERIES_REVISION_CONFLICT,
    });
    expect(
      await prisma.client.publishedIndexValue.count({
        where: { seriesId: created.id },
      }),
    ).toBe(2);
  });

  it('finds the latest year of an index', async () => {
    for (const year of [YEAR + 1, YEAR]) {
      const series = PublishedIndexSeries.create(EPublishedIndex.CDI, year);
      series.append([published(`${year}-01-05`)], AT);
      await save(series);
    }

    const latest = await repository.findLatest(EPublishedIndex.CDI);

    expect(latest.value.year).toBe(YEAR + 1);
  });
});
