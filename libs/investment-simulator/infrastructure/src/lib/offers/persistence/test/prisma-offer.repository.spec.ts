import {
  ETitleType,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  DomainEventRecorder,
  EAppErrorCode,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import {
  PrismaService,
  RepositoryFindError,
} from '@investflow/shared-infrastructure';
import {
  InvestmentRedemptionType,
  InvestmentRemunerationType,
  InvestmentTitleType,
  Offer as OfferRecord,
  Prisma,
  OfferScope,
} from '@prisma/client';
import { PrismaOfferRepository } from '../prisma-offer.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const AT = UtcInstant.ofIso('2026-10-11T12:00:00Z');

function fixture() {
  const offer = {
    findUnique: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const events = { record: jest.fn() };
  return {
    offer,
    events,
    repository: new PrismaOfferRepository(
      {
        client: { offer },
      } as unknown as PrismaService,
      events as unknown as DomainEventRecorder,
    ),
  };
}

function record(): OfferRecord {
  return {
    id: ID,
    ownerId: 'user-id',
    titleType: InvestmentTitleType.LCI,
    name: 'LCI 95% do CDI',
    issuerName: null,
    maturityDate: new Date('2030-05-20T00:00:00Z'),
    redemptionType: InvestmentRedemptionType.AT_MATURITY,
    remunerationType: InvestmentRemunerationType.CDI_PERCENTAGE,
    rateValue: new Prisma.Decimal('0.123456789012345678901234567891'),
    revision: 3,
    termsRevision: 2,
    scope: OfferScope.CATALOG,
    basedOnOfferId: null,
    deletedAt: null,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    updatedAt: new Date('2026-10-01T12:00:00Z'),
  };
}

describe('PrismaOfferRepository', () => {
  it('loads an active offer with its terms and all decimal digits', async () => {
    const test = fixture();
    test.offer.findUnique.mockResolvedValue(record());

    const offer = (await test.repository.findById(ID)).value;

    expect(test.offer.findUnique).toHaveBeenCalledWith({
      where: { id: ID, deletedAt: null },
    });
    expect(offer.titleType).toBe(ETitleType.LCI);
    expect(offer.ownerId).toBe('user-id');
    expect(offer.name).toBe('LCI 95% do CDI');
    expect(offer.issuerName).toBeNull();
    expect(offer.maturityDate.toIsoString()).toBe('2030-05-20');
    expect(offer.redemptionTerms.kind).toBe('AT_MATURITY');
    expect(offer.remunerationTerms.kind).toBe('CDI_PERCENTAGE');
    expect(offer.remunerationTerms.contractRate.value.toString()).toBe(
      '0.123456789012345678901234567891',
    );
    expect(offer.revision).toBe(3);
  });

  it('reports a missing offer and wraps read failures', async () => {
    const missing = fixture();
    missing.offer.findUnique.mockResolvedValue(null);
    const failing = fixture();
    failing.offer.findUnique.mockRejectedValue(new Error('read'));

    expect((await missing.repository.findById(ID)).error.code).toBe(
      EAppErrorCode.OFFER_NOT_FOUND,
    );
    expect((await failing.repository.findById(ID)).error).toBeInstanceOf(
      RepositoryFindError,
    );
  });

  it('inserts a new offer with its creation event', async () => {
    const test = fixture();
    const offer = Offer.create(
      {
        ownerId: null,
        titleType: ETitleType.CDB,
        name: 'CDB prefixado',
        maturityDate: CalendarDate.of('2030-05-20'),
        redemptionTerms: RedemptionTerms.create('DAILY'),
        remunerationTerms: RemunerationTerms.create(
          'PREFIXED',
          Rate.of('0.12'),
        ),
      },
      AT,
    );

    expect((await test.repository.save(offer)).isOk()).toBe(true);

    expect(test.offer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: offer.id,
        ownerId: null,
        name: 'CDB prefixado',
        rateValue: '0.12',
        revision: 1,
      }),
    });
    expect(test.offer.updateMany).not.toHaveBeenCalled();
    expect(test.events.record).toHaveBeenCalledTimes(1);
  });

  it('updates from the revision it read', async () => {
    const test = fixture();
    test.offer.findUnique.mockResolvedValue(record());
    const offer = (await test.repository.findById(ID)).value;
    offer.edit({ name: 'LCI 96% do CDI' }, AT);

    expect((await test.repository.save(offer)).isOk()).toBe(true);

    expect(test.offer.updateMany).toHaveBeenCalledWith({
      where: { id: ID, revision: 3 },
      data: expect.objectContaining({ name: 'LCI 96% do CDI', revision: 4 }),
    });
    expect(test.offer.create).not.toHaveBeenCalled();
  });

  it('writes nothing for an unchanged offer', async () => {
    const test = fixture();
    test.offer.findUnique.mockResolvedValue(record());
    const offer = (await test.repository.findById(ID)).value;

    expect((await test.repository.save(offer)).isOk()).toBe(true);

    expect(test.offer.updateMany).not.toHaveBeenCalled();
    expect(test.offer.create).not.toHaveBeenCalled();
  });

  it('reports a conflict when another writer changed the revision', async () => {
    const test = fixture();
    test.offer.findUnique.mockResolvedValue(record());
    test.offer.updateMany.mockResolvedValue({ count: 0 });
    const offer = (await test.repository.findById(ID)).value;
    offer.edit({ name: 'Outra' }, AT);

    const result = await test.repository.save(offer);

    expect(result.error.code).toBe(EAppErrorCode.OFFER_REVISION_CONFLICT);
    expect(result.error.kind).toBe('conflict');
    expect(test.events.record).not.toHaveBeenCalled();
  });
});
