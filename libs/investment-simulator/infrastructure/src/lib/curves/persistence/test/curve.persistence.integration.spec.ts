import { ConfigService } from '@nestjs/config';
import {
  Curve,
  CurveInterval,
  EEconomicIndex,
  IndexValue,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  EAppErrorCode,
  UtcInstant,
} from '@investflow/shared-domain';
import { Clock } from '@investflow/shared-application';
import {
  PrismaService,
  TransactionalDomainEventRecorder,
  UnitOfWork,
} from '@investflow/shared-infrastructure';
import { PrismaCurveRepository } from '../prisma-curve.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const connectionString = process.env['INTEGRATION_TEST_DATABASE_URL'];
if (!connectionString) {
  throw new Error(
    'INTEGRATION_TEST_DATABASE_URL is not set; run pnpm check:integration',
  );
}

const AT = UtcInstant.ofIso('2026-10-11T12:00:00Z');

function interval(start: string, end: string, value: string) {
  return CurveInterval.create(
    CalendarDateRange.of(CalendarDate.of(start), CalendarDate.of(end)),
    IndexValue.of(value),
  );
}

// Each save runs in its own unit of work, as a request would.
function inUnitOfWork<R extends { save(aggregate: never): Promise<unknown> }>(
  unitOfWork: UnitOfWork,
  repository: R,
): R {
  const save = repository.save.bind(repository);
  return Object.assign(repository, {
    save: (aggregate: never) => unitOfWork.run(() => save(aggregate)),
  });
}

describe('Curve PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let unitOfWork: UnitOfWork;
  const clock: Clock = {
    now: () => AT,
    today: () => CalendarDate.of('2026-10-11'),
  };
  const events = new TransactionalDomainEventRecorder(clock);
  const curveIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: connectionString }),
    );
    unitOfWork = new UnitOfWork(prisma);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    try {
      await prisma.client.curveInterval.deleteMany({
        where: { curveId: { in: curveIds } },
      });
      await prisma.client.curve.deleteMany({ where: { id: { in: curveIds } } });
      await prisma.client.outboxEvent.deleteMany({
        where: { aggregateId: { in: curveIds } },
      });
    } finally {
      await prisma.onApplicationShutdown();
    }
  });

  async function savedCurve() {
    const curve = Curve.create(
      {
        ownerId: 'user-id',
        index: EEconomicIndex.IPCA,
        name: 'IPCA',
        intervals: [
          interval('2024-02-01', '2024-02-29', '-0.004'),
          interval(
            '2024-03-01',
            '2024-03-31',
            '0.123456789012345678901234567891',
          ),
        ],
      },
      AT,
    ).value;
    curveIds.push(curve.id);
    const saved = await inUnitOfWork(
      unitOfWork,
      new PrismaCurveRepository(prisma, events),
    ).save(curve);
    expect(saved.isOk()).toBe(true);
    return curve;
  }

  it('round trips a curve with deflation and all decimal digits', async () => {
    const curve = await savedCurve();

    const loaded = (
      await inUnitOfWork(
        unitOfWork,
        new PrismaCurveRepository(prisma, events),
      ).findById(curve.id)
    ).value;

    expect(loaded.index).toBe(EEconomicIndex.IPCA);
    expect(loaded.revision).toBe(1);
    expect(loaded.intervals.map((i) => i.value.value.toString())).toEqual([
      '-0.004',
      '0.123456789012345678901234567891',
    ]);
    expect(
      await prisma.client.outboxEvent.count({
        where: { aggregateId: curve.id },
      }),
    ).toBe(1);
  });

  it('replaces intervals on edit and refuses a concurrent edit of the same revision', async () => {
    const curve = await savedCurve();
    const first = inUnitOfWork(
      unitOfWork,
      new PrismaCurveRepository(prisma, events),
    );
    const second = inUnitOfWork(
      unitOfWork,
      new PrismaCurveRepository(prisma, events),
    );
    const mine = (await first.findById(curve.id)).value;
    const theirs = (await second.findById(curve.id)).value;

    mine.edit(
      { intervals: [interval('2024-04-01', '2024-04-30', '0.003')] },
      AT,
    );
    theirs.edit({ name: 'Concorrente' }, AT);

    expect((await first.save(mine)).isOk()).toBe(true);
    const conflict = await second.save(theirs);
    expect(conflict.error.code).toBe(EAppErrorCode.CURVE_REVISION_CONFLICT);

    const stored = (
      await inUnitOfWork(
        unitOfWork,
        new PrismaCurveRepository(prisma, events),
      ).findById(curve.id)
    ).value;
    expect(stored.revision).toBe(2);
    expect(stored.valuesRevision).toBe(2);
    expect(stored.name).toBe('IPCA');
    expect(stored.intervals).toHaveLength(1);
    expect(stored.intervals[0].range.start.toIsoString()).toBe('2024-04-01');
  });

  it('hides a deleted curve from lookups', async () => {
    const curve = await savedCurve();
    const curves = inUnitOfWork(
      unitOfWork,
      new PrismaCurveRepository(prisma, events),
    );

    const loaded = (await curves.findById(curve.id)).value;
    expect((await curves.save(loaded.delete(AT))).isOk()).toBe(true);

    expect((await curves.findById(curve.id)).error.code).toBe(
      EAppErrorCode.CURVE_NOT_FOUND,
    );
  });
});
