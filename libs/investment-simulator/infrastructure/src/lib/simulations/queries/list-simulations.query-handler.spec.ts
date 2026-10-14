import { PrismaService } from '@investflow/shared-infrastructure';
import {
  ListSimulationsQuery,
  ListSimulationsQueryHandler,
} from './list-simulations.query-handler';

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
});
