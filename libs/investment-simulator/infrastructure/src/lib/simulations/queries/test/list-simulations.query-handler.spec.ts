import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import {
  ListSimulationsQuery,
  ListSimulationsQueryHandler,
} from '../list-simulations.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const OWNER = 'user-1';
const OWNED = { ownerId: OWNER, deletedAt: null };
const OFFER_ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const CURVE_ID = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';

function fixture() {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(41);
  const prisma = {
    client: { simulation: { findMany, count } },
  } as unknown as PrismaService;
  return { handler: new ListSimulationsQueryHandler(prisma), findMany, count };
}

async function whereFor(filters: Partial<ListSimulationsQuery>) {
  const f = fixture();
  await f.handler.execute({
    ownerId: OWNER,
    page: 1,
    pageSize: 20,
    ...filters,
  });
  const where = f.findMany.mock.calls[0][0].where;
  expect(f.count).toHaveBeenCalledWith({ where });
  return where.AND.filter(
    (part: object) => Object.keys(part).length > 0,
  ) as object[];
}

describe('ListSimulationsQueryHandler', () => {
  it("lists only the owner's undeleted simulations without filters", async () => {
    expect(await whereFor({})).toEqual([OWNED]);
  });

  it.each([
    [{ offerId: OFFER_ID }, { offerId: OFFER_ID }],
    [{ curveId: CURVE_ID }, { curveId: CURVE_ID }],
    [{ titleType: 'LCI' }, { offer: { titleType: 'LCI' } }],
    [
      { remunerationKind: 'SELIC_PERCENTAGE' },
      { offer: { remunerationType: 'SELIC_PERCENTAGE' } },
    ],
    [{ calculationStatus: 'INVALID' }, { calculation: { status: 'INVALID' } }],
  ] as const)('filters by %o within the owner scope', async (filter, part) => {
    expect(await whereFor(filter)).toEqual([OWNED, part]);
  });

  it('combines filters with AND, keeping the owner scope', async () => {
    expect(
      await whereFor({
        offerId: OFFER_ID,
        titleType: 'CDB',
        remunerationKind: 'CDI_PERCENTAGE',
        calculationStatus: 'PENDING',
      }),
    ).toEqual([
      OWNED,
      { offerId: OFFER_ID },
      { offer: { titleType: 'CDB' } },
      { offer: { remunerationType: 'CDI_PERCENTAGE' } },
      { calculation: { status: 'PENDING' } },
    ]);
  });

  it('pages the filtered items and reports the filtered total', async () => {
    const f = fixture();

    const result = await f.handler.execute({
      ownerId: OWNER,
      page: 3,
      pageSize: 20,
      offerId: OFFER_ID,
    });

    expect(f.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
    expect(result.value).toEqual({
      items: [],
      total: 41,
      page: 3,
      pageSize: 20,
    });
  });

  it('orders newest first by default', async () => {
    const f = fixture();

    await f.handler.execute({ ownerId: OWNER, page: 1, pageSize: 20 });

    expect(f.findMany).toHaveBeenCalledTimes(1);
    expect(f.findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
  });

  describe('sorted by net annual return', () => {
    const record = (id: string, netAnnualReturn: string | null) => ({
      id,
      revision: 1,
      principal: new Prisma.Decimal('1000'),
      investmentDate: new Date('2026-01-02T00:00:00.000Z'),
      offer: {
        name: 'CDB',
        titleType: 'CDB',
        issuerName: null,
        maturityDate: new Date('2027-01-04T00:00:00.000Z'),
        remunerationType: 'PREFIXED',
        rateValue: new Prisma.Decimal('0.12'),
        termsRevision: 1,
      },
      curve: null,
      calculation: { status: netAnnualReturn ? 'CALCULATED' : 'PENDING' },
      result: netAnnualReturn && {
        simulationRevision: 1,
        offerTermsRevision: 1,
        curveValuesRevision: null,
        methodologyVersion: 'cdb-252-v1',
        calculatedAt: new Date('2026-10-10T12:00:00.000Z'),
        netBalance: new Prisma.Decimal('1100'),
        netAnnualReturn: new Prisma.Decimal(netAnnualReturn),
      },
    });

    // 25 simulations have a result; 41 match in all.
    function sortedFixture() {
      const findMany = jest.fn();
      const count = jest.fn(({ where }) =>
        Promise.resolve(where.AND?.[1]?.result ? 25 : 41),
      );
      const prisma = {
        client: { simulation: { findMany, count } },
      } as unknown as PrismaService;
      return {
        handler: new ListSimulationsQueryHandler(prisma),
        findMany,
      };
    }

    const execute = (handler: ListSimulationsQueryHandler, page: number) =>
      handler.execute({
        ownerId: OWNER,
        page,
        pageSize: 20,
        titleType: 'CDB',
        sort: 'netAnnualReturn',
      });

    it('ranks simulations with a result by return, then newest first', async () => {
      const f = sortedFixture();
      f.findMany
        .mockResolvedValueOnce([record('a', '0.11')])
        .mockResolvedValueOnce([]);

      const result = await execute(f.handler, 1);

      const [call] = f.findMany.mock.calls[0];
      expect(call.where.AND[1]).toEqual({ result: { isNot: null } });
      expect(call.orderBy).toEqual([
        { result: { netAnnualReturn: 'desc' } },
        { createdAt: 'desc' },
        { id: 'asc' },
      ]);
      expect(call).toMatchObject({ skip: 0, take: 20 });
      expect(result.value.items[0].result?.netAnnualReturn).toBe('0.11');
      expect(result.value.total).toBe(41);
    });

    it('continues with the simulations without a result on the boundary page', async () => {
      const f = sortedFixture();
      f.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 5 }, (_, i) => record(`r${i}`, '0.1')),
        )
        .mockResolvedValueOnce([record('n', null)]);

      const result = await execute(f.handler, 2);

      expect(f.findMany.mock.calls[0][0]).toMatchObject({ skip: 20, take: 20 });
      const [unranked] = f.findMany.mock.calls[1];
      expect(unranked.where.AND[1]).toEqual({ result: { is: null } });
      expect(unranked).toMatchObject({
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 0,
        take: 15,
      });
      expect(result.value.items.map((item) => item.id)).toEqual([
        'r0',
        'r1',
        'r2',
        'r3',
        'r4',
        'n',
      ]);
      expect(result.value.items[5].result).toBeNull();
    });

    it('pages only the simulations without a result past the ranked ones', async () => {
      const f = sortedFixture();
      f.findMany.mockResolvedValueOnce([]);

      await execute(f.handler, 3);

      expect(f.findMany).toHaveBeenCalledTimes(1);
      expect(f.findMany.mock.calls[0][0]).toMatchObject({
        where: { AND: [expect.anything(), { result: { is: null } }] },
        skip: 15,
        take: 20,
      });
    });
  });
});
