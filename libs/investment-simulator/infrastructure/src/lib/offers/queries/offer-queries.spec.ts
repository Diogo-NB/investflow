import { EAppErrorCode } from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@investflow/shared-infrastructure';
import { ListOffersQueryHandler } from './list-offers.query-handler';
import { GetOfferQueryHandler } from './get-offer.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const VIEWER = 'user-1';
const VISIBLE = {
  deletedAt: null,
  OR: [{ ownerId: null }, { ownerId: VIEWER }],
};

const record = {
  id: 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c',
  titleType: 'CDB',
  name: 'CDB 112% do CDI',
  issuerName: 'Banco Local',
  maturityDate: new Date('2028-12-31T00:00:00Z'),
  redemptionType: 'DAILY',
  remunerationType: 'CDI_PERCENTAGE',
  rateValue: new Prisma.Decimal('1.12345678901234567890123456789'),
  ownerId: null,
  revision: 3,
};

const summary = {
  id: record.id,
  titleType: 'CDB',
  name: record.name,
  issuerName: record.issuerName,
  maturityDate: '2028-12-31',
  redemptionTerms: { kind: 'DAILY' },
  remunerationTerms: {
    kind: 'CDI_PERCENTAGE',
    rate: '1.12345678901234567890123456789',
  },
  origin: 'SYSTEM',
  revision: 3,
};

function fixture() {
  const findMany = jest.fn().mockResolvedValue([record]);
  const count = jest.fn().mockResolvedValue(21);
  const findFirst = jest.fn().mockResolvedValue(record);
  const prisma = {
    client: { offer: { findMany, count, findFirst } },
  } as unknown as PrismaService;
  return {
    list: new ListOffersQueryHandler(prisma),
    get: new GetOfferQueryHandler(prisma),
    findMany,
    count,
    findFirst,
  };
}

describe('Offer reads', () => {
  it('applies identical visibility, search and title filters to items and count with stable pagination', async () => {
    const f = fixture();

    const result = await f.list.execute({
      viewerId: VIEWER,
      page: 2,
      pageSize: 20,
      q: 'local',
      titleType: 'CDB',
    });

    const where = {
      AND: [
        VISIBLE,
        { titleType: 'CDB' },
        {},
        {
          OR: [
            { name: { contains: 'local', mode: 'insensitive' } },
            { issuerName: { contains: 'local', mode: 'insensitive' } },
          ],
        },
      ],
    };
    expect(f.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 20, take: 20 }),
    );
    expect(f.count).toHaveBeenCalledWith({ where });
    expect(result.value).toMatchObject({ total: 21, page: 2, pageSize: 20 });
    expect(result.value.items).toEqual([summary]);
  });

  it.each([
    ['OWN', { ownerId: VIEWER }],
    ['SYSTEM', { ownerId: null }],
  ] as const)(
    'narrows the visible offers to the %s origin',
    async (origin, part) => {
      const f = fixture();

      await f.list.execute({ viewerId: VIEWER, page: 1, pageSize: 20, origin });

      const where = { AND: [VISIBLE, {}, part, {}] };
      expect(f.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where }),
      );
      expect(f.count).toHaveBeenCalledWith({ where });
    },
  );

  it("marks the viewer's own offers", async () => {
    const f = fixture();
    f.findMany.mockResolvedValue([{ ...record, ownerId: VIEWER }]);

    const result = await f.list.execute({
      viewerId: VIEWER,
      page: 1,
      pageSize: 20,
    });

    expect(result.value.items[0].origin).toBe('OWN');
  });

  it('reads only a visible offer and renders tiny decimals without scientific notation', async () => {
    const f = fixture();
    f.findFirst.mockResolvedValue({
      ...record,
      rateValue: new Prisma.Decimal('0.000000000000000000000000000001'),
    });

    const result = await f.get.execute({
      viewerId: VIEWER,
      offerId: record.id,
    });

    expect(f.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: record.id, ...VISIBLE } }),
    );
    expect(result.value.remunerationTerms.rate).toBe(
      '0.000000000000000000000000000001',
    );
  });

  it('treats absent, deleted and invisible records as OFFER_NOT_FOUND', async () => {
    const f = fixture();
    f.findFirst.mockResolvedValue(null);

    const result = await f.get.execute({
      viewerId: VIEWER,
      offerId: record.id,
    });

    expect(result.error.code).toBe(EAppErrorCode.OFFER_NOT_FOUND);
  });

  it('maps database and conversion failures into query errors', async () => {
    const f = fixture();
    f.count.mockRejectedValue(new Error('database'));
    f.findFirst.mockResolvedValue({ ...record, maturityDate: new Date('x') });

    const list = await f.list.execute({
      viewerId: VIEWER,
      page: 1,
      pageSize: 20,
    });
    const get = await f.get.execute({ viewerId: VIEWER, offerId: record.id });

    expect(list.error.code).toBe(EAppErrorCode.OFFER_QUERY_FAILED);
    expect(get.error.code).toBe(EAppErrorCode.OFFER_QUERY_FAILED);
  });
});
