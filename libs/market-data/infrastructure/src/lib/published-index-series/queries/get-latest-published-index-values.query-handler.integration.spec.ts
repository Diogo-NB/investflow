import { PrismaService } from '@investflow/shared-infrastructure';
import { randomUUID } from 'node:crypto';
import { GetLatestPublishedIndexValuesQueryHandler } from './get-latest-published-index-values.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const connectionString = process.env['INTEGRATION_TEST_DATABASE_URL'];
if (!connectionString) {
  throw new Error(
    'INTEGRATION_TEST_DATABASE_URL is not set; run pnpm check:integration',
  );
}

describe('GetLatestPublishedIndexValuesQueryHandler', () => {
  let prisma: PrismaService;
  let handler: GetLatestPublishedIndexValuesQueryHandler;

  async function clean(): Promise<void> {
    await prisma.client.publishedIndexValue.deleteMany();
    await prisma.client.publishedIndexSeries.deleteMany();
  }

  async function store(
    index: 'CDI' | 'SELIC' | 'SELIC_TARGET',
    year: number,
    values: readonly (readonly [string, string])[],
  ): Promise<void> {
    await prisma.client.publishedIndexSeries.create({
      data: {
        id: randomUUID(),
        index,
        year,
        revision: 1,
        values: {
          create: values.map(([referenceDate, value]) => ({
            referenceDate: new Date(`${referenceDate}T00:00:00.000Z`),
            value,
          })),
        },
      },
    });
  }

  beforeAll(async () => {
    prisma = new PrismaService({ url: connectionString });
    await prisma.onModuleInit();
    handler = new GetLatestPublishedIndexValuesQueryHandler(prisma);
  });

  beforeEach(clean);

  afterAll(async () => {
    try {
      await clean();
    } finally {
      await prisma.onApplicationShutdown();
    }
  });

  it('returns the last value of each index, from its newest year', async () => {
    await store('CDI', 2026, [
      ['2026-12-30', '0.1365'],
      ['2026-12-31', '0.1350'],
    ]);
    await store('CDI', 2027, [
      ['2027-01-04', '0.1340'],
      ['2027-01-05', '0.1325'],
    ]);
    await store('SELIC_TARGET', 2027, [['2027-01-05', '0.1375']]);

    const result = await handler.execute();

    expect(result.value.items).toEqual([
      { index: 'CDI', referenceDate: '2027-01-05', value: '0.1325' },
      { index: 'SELIC_TARGET', referenceDate: '2027-01-05', value: '0.1375' },
    ]);
  });

  it('returns nothing while no index has values', async () => {
    const result = await handler.execute();

    expect(result.value.items).toEqual([]);
  });
});
