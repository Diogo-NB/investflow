import {
  RemunerationTerms,
  Offer,
  TitleType,
  RedemptionTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate, UtcInstant } from '@investflow/shared-domain';
import {
  PrismaService,
  RepositoryFindError,
  RepositorySaveError,
} from '@investflow/shared-infrastructure';
import {
  InvestmentOffer,
  InvestmentRedemptionType,
  InvestmentRemunerationType,
  InvestmentTitleType,
  Prisma,
} from '@prisma/client';
import { PrismaOfferRepository } from './prisma-offer.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const ISSUER_ID = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';

function createFixture() {
  const findUnique = jest.fn();
  const upsert = jest.fn().mockResolvedValue(undefined);
  const createMany = jest.fn();
  const client = {
    investmentOffer: { findUnique, upsert },
    outboxEvent: { createMany },
  };
  return {
    repository: new PrismaOfferRepository({
      client,
    } as unknown as PrismaService),
    findUnique,
    upsert,
    createMany,
  };
}

function record(overrides: Partial<InvestmentOffer> = {}): InvestmentOffer {
  return {
    id: ID,
    titleType: InvestmentTitleType.CDB,
    issuerId: ISSUER_ID,
    maturityDate: new Date('2030-05-20T00:00:00Z'),
    redemptionType: InvestmentRedemptionType.AT_MATURITY,
    remunerationType: InvestmentRemunerationType.PREFIXED,
    rateValue: new Prisma.Decimal('12'),
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function offer() {
  return Offer.reconstitute({
    deletedAt: null,
    id: ID,
    titleType: TitleType.CDB,
    issuerId: ISSUER_ID,
    maturityDate: CalendarDate.of('2030-05-20'),
    redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
    remunerationTerms: RemunerationTerms.create('PREFIXED', Rate.of('12')),
  });
}

describe('PrismaOfferRepository', () => {
  it('finds only an active offer and maps it', async () => {
    const fixture = createFixture();
    fixture.findUnique.mockResolvedValue(record());

    const result = await fixture.repository.findById(ID);

    expect(result.isOk()).toBe(true);
    expect(result.value.id).toBe(ID);
    expect(fixture.findUnique).toHaveBeenCalledWith({
      where: { id: ID, deletedAt: null },
    });
  });

  it('returns OfferNotFoundError for absent or deleted offers', async () => {
    const fixture = createFixture();
    fixture.findUnique.mockResolvedValue(null);

    const result = await fixture.repository.findById(ID);

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe('OFFER_NOT_FOUND');
  });

  it('wraps Prisma and mapper read failures', async () => {
    const prismaFailure = createFixture();
    prismaFailure.findUnique.mockRejectedValue(new Error('read failed'));
    const mapperFailure = createFixture();
    mapperFailure.findUnique.mockResolvedValue(
      record({ rateValue: new Prisma.Decimal(0) }),
    );

    const results = await Promise.all([
      prismaFailure.repository.findById(ID),
      mapperFailure.repository.findById(ID),
    ]);

    for (const result of results) {
      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(RepositoryFindError);
    }
  });

  it('upserts every domain field and does not write an empty outbox', async () => {
    const fixture = createFixture();

    const result = await fixture.repository.save(offer());

    expect(result.isOk()).toBe(true);
    expect(fixture.upsert).toHaveBeenCalledWith({
      where: { id: ID },
      create: {
        id: ID,
        titleType: InvestmentTitleType.CDB,
        issuerId: ISSUER_ID,
        maturityDate: new Date('2030-05-20T00:00:00.000Z'),
        redemptionType: InvestmentRedemptionType.AT_MATURITY,
        remunerationType: InvestmentRemunerationType.PREFIXED,
        rateValue: '12',
        deletedAt: null,
      },
      update: {
        titleType: InvestmentTitleType.CDB,
        issuerId: ISSUER_ID,
        maturityDate: new Date('2030-05-20T00:00:00.000Z'),
        redemptionType: InvestmentRedemptionType.AT_MATURITY,
        remunerationType: InvestmentRemunerationType.PREFIXED,
        rateValue: '12',
        deletedAt: null,
      },
    });
    expect(fixture.createMany).not.toHaveBeenCalled();
  });

  it('persists deletedAt and subsequently treats the offer as not found', async () => {
    const fixture = createFixture();
    const deletedAt = UtcInstant.ofIso('2026-09-27T12:00:00Z');
    const deletedOffer = offer().delete(deletedAt);

    expect((await fixture.repository.save(deletedOffer)).isOk()).toBe(true);
    expect(fixture.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ deletedAt: deletedAt.date }),
        update: expect.objectContaining({ deletedAt: deletedAt.date }),
      }),
    );

    fixture.findUnique.mockResolvedValue(null);
    const result = await fixture.repository.findById(ID);
    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe('OFFER_NOT_FOUND');
  });

  it('maps write failures to RepositorySaveError', async () => {
    const fixture = createFixture();
    fixture.upsert.mockRejectedValue(new Error('write failed'));

    const result = await fixture.repository.save(offer());

    expect(result.isErr()).toBe(true);
    expect(result.error).toBeInstanceOf(RepositorySaveError);
  });
});
