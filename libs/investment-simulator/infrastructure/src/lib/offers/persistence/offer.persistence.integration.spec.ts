import { ConfigService } from '@nestjs/config';
import {
  ETitleType,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  EAppErrorCode,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  PrismaService,
  TransactionalDomainEventRecorder,
  UnitOfWork,
} from '@investflow/shared-infrastructure';
import { PrismaOfferRepository } from './prisma-offer.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

// Run against a database with the migrations already applied.
const connectionString = process.env['INVESTMENT_SIMULATOR_TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

const AT = UtcInstant.ofIso('2026-10-11T12:00:00Z');

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

integration('Offer PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let unitOfWork: UnitOfWork;
  const events = new TransactionalDomainEventRecorder();
  const offerIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: connectionString }),
    );
    unitOfWork = new UnitOfWork(prisma);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    try {
      await prisma.client.offer.deleteMany({ where: { id: { in: offerIds } } });
      await prisma.client.outboxEvent.deleteMany({
        where: { aggregateId: { in: offerIds } },
      });
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  async function savedOffer() {
    const offer = Offer.create(
      {
        ownerId: 'user-id',
        titleType: ETitleType.CDB,
        name: 'CDB 110% do CDI',
        issuerName: 'Banco Local',
        maturityDate: CalendarDate.of('2030-05-20'),
        redemptionTerms: RedemptionTerms.create('DAILY'),
        remunerationTerms: RemunerationTerms.create(
          'CDI_PERCENTAGE',
          Rate.of('1.123456789012345678901234567891'),
        ),
      },
      AT,
    ).value;
    offerIds.push(offer.id);
    const saved = await inUnitOfWork(
      unitOfWork,
      new PrismaOfferRepository(prisma, events),
    ).save(offer);
    expect(saved.isOk()).toBe(true);
    return offer;
  }

  it('round trips an offer with all decimal digits and its event', async () => {
    const offer = await savedOffer();

    const loaded = (
      await inUnitOfWork(
        unitOfWork,
        new PrismaOfferRepository(prisma, events),
      ).findById(offer.id)
    ).value;

    expect(loaded.name).toBe('CDB 110% do CDI');
    expect(loaded.revision).toBe(1);
    expect(loaded.remunerationTerms.contractRate.value.toString()).toBe(
      '1.123456789012345678901234567891',
    );
    expect(
      await prisma.client.outboxEvent.count({
        where: { aggregateId: offer.id },
      }),
    ).toBe(1);
  });

  it('refuses a concurrent edit of the same revision', async () => {
    const offer = await savedOffer();
    const first = inUnitOfWork(
      unitOfWork,
      new PrismaOfferRepository(prisma, events),
    );
    const second = inUnitOfWork(
      unitOfWork,
      new PrismaOfferRepository(prisma, events),
    );
    const mine = (await first.findById(offer.id)).value;
    const theirs = (await second.findById(offer.id)).value;

    mine.edit({ maturityDate: CalendarDate.of('2031-01-02') }, AT);
    theirs.edit({ name: 'Concorrente' }, AT);

    expect((await first.save(mine)).isOk()).toBe(true);
    const conflict = await second.save(theirs);
    expect(conflict.error.code).toBe(EAppErrorCode.OFFER_REVISION_CONFLICT);

    const stored = (
      await inUnitOfWork(
        unitOfWork,
        new PrismaOfferRepository(prisma, events),
      ).findById(offer.id)
    ).value;
    expect(stored.revision).toBe(2);
    expect(stored.name).toBe('CDB 110% do CDI');
    expect(stored.maturityDate.toIsoString()).toBe('2031-01-02');
  });

  it('hides a deleted offer from lookups', async () => {
    const offer = await savedOffer();
    const offers = inUnitOfWork(
      unitOfWork,
      new PrismaOfferRepository(prisma, events),
    );

    const loaded = (await offers.findById(offer.id)).value;
    expect((await offers.save(loaded.delete(AT))).isOk()).toBe(true);

    expect((await offers.findById(offer.id)).error.code).toBe(
      EAppErrorCode.OFFER_NOT_FOUND,
    );
  });
});
