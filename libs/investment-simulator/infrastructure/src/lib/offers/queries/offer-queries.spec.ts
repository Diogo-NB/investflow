import { EAppErrorCode } from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@investflow/shared-infrastructure';
import { ListOffersQueryHandler } from './list-offers.query-handler';
import { GetOfferQueryHandler } from './get-offer.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const record = {
  id: 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c',
  titleType: 'CDB',
  issuerName: 'Banco Local',
  maturityDate: new Date('2028-12-31T00:00:00Z'),
  redemptionType: 'DAILY',
  remunerationType: 'CDI_PERCENTAGE',
  rateValue: new Prisma.Decimal('1.12345678901234567890123456789'),
};

function fixture() {
  const findMany = jest.fn().mockResolvedValue([record]);
  const count = jest.fn().mockResolvedValue(21);
  const findUnique = jest.fn().mockResolvedValue(record);
  const prisma = {
    client: { investmentOffer: { findMany, count, findUnique } },
  } as unknown as PrismaService;
  return {
    list: new ListOffersQueryHandler(prisma),
    get: new GetOfferQueryHandler(prisma),
    findMany,
    count,
    findUnique,
  };
}

describe('Offer reads', () => {
  it('applies identical active/search/title filters to items and count with stable pagination', async () => {
    const f = fixture();
    const result = await f.list.execute({
      page: 2,
      pageSize: 20,
      q: 'local',
      titleType: 'CDB',
    });
    const where = {
      deletedAt: null,
      titleType: 'CDB',
      issuerName: { contains: 'local', mode: 'insensitive' },
    };
    expect(f.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 20,
        take: 20,
        orderBy: [{ maturityDate: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(f.count).toHaveBeenCalledWith({ where });
    const page = result.value;
    expect(page).toMatchObject({ total: 21, page: 2, pageSize: 20 });
    expect(page.items[0]).toEqual({
      id: record.id,
      titleType: 'CDB',
      issuerName: record.issuerName,
      maturityDate: '2028-12-31',
      redemptionTerms: { kind: 'DAILY' },
      remunerationTerms: {
        kind: 'CDI_PERCENTAGE',
        rate: '1.12345678901234567890123456789',
      },
    });
  });

  it('returns an empty requested page without dropping the matching count', async () => {
    const f = fixture();
    f.findMany.mockResolvedValue([]);
    expect(
      (await f.list.execute({ page: 3, pageSize: 20 })).value,
    ).toMatchObject({ items: [], total: 21, page: 3 });
  });

  it('reads only active details and renders tiny decimals without scientific notation', async () => {
    const f = fixture();
    f.findUnique.mockResolvedValue({
      ...record,
      rateValue: new Prisma.Decimal('0.000000000000000000000000000001'),
    });
    const result = await f.get.execute({ offerId: record.id });
    expect(f.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: record.id, deletedAt: null },
      }),
    );
    expect(result.value).toEqual({
      id: record.id,
      titleType: 'CDB',
      issuerName: record.issuerName,
      maturityDate: '2028-12-31',
      redemptionTerms: { kind: 'DAILY' },
      remunerationTerms: {
        kind: 'CDI_PERCENTAGE',
        rate: '0.000000000000000000000000000001',
      },
    });
  });

  it('treats absent and deleted records as OFFER_NOT_FOUND', async () => {
    const f = fixture();
    f.findUnique.mockResolvedValue(null);
    expect((await f.get.execute({ offerId: record.id })).error.code).toBe(
      EAppErrorCode.OFFER_NOT_FOUND,
    );
  });

  it('maps database failures into infrastructure errors', async () => {
    const f = fixture();
    f.count.mockRejectedValue(new Error('database'));
    expect((await f.list.execute({ page: 1, pageSize: 20 })).error.code).toBe(
      EAppErrorCode.OFFER_QUERY_FAILED,
    );
    f.findUnique.mockRejectedValue(new Error('database'));
    expect((await f.get.execute({ offerId: record.id })).error.code).toBe(
      EAppErrorCode.OFFER_QUERY_FAILED,
    );
  });

  it('captures date conversion failures inside both query results', async () => {
    const f = fixture();
    const invalidRecord = { ...record, maturityDate: new Date('invalid') };
    f.findMany.mockResolvedValue([invalidRecord]);
    f.findUnique.mockResolvedValue(invalidRecord);
    expect((await f.list.execute({ page: 1, pageSize: 20 })).error.code).toBe(
      EAppErrorCode.OFFER_QUERY_FAILED,
    );
    expect((await f.get.execute({ offerId: record.id })).error.code).toBe(
      EAppErrorCode.OFFER_QUERY_FAILED,
    );
  });
});
