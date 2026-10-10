import { ConfigService } from '@nestjs/config';
import {
  Application,
  EconomicIndex,
  IndexCurve,
  IndexCurveInterval,
  IndexValue,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
  TitleType,
} from '@investflow/investment-simulator-domain';
import {
  CalendarDate,
  CalendarDateRange,
  generateUuid,
  Money,
  Rate,
  UtcInstant,
} from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { PrismaIndexCurveRepository } from '../../index-curves/persistence/prisma-index-curve.repository';
import { PrismaOfferRepository } from '../../offers/persistence/prisma-offer.repository';
import { ListOffersQueryHandler } from '../../offers/queries/list-offers.query-handler';
import { GetApplicationQueryHandler } from '../queries/get-application.query-handler';
import { ListApplicationsQueryHandler } from '../queries/list-applications.query-handler';
import { PrismaApplicationRepository } from './prisma-application.repository';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

// Run against a database with the migrations already applied.
const connectionString = process.env['INVESTMENT_SIMULATOR_TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

integration('Application PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let offers: PrismaOfferRepository;
  let curves: PrismaIndexCurveRepository;
  let applications: PrismaApplicationRepository;
  const issuerId = generateUuid();
  const ownerId = `owner-${generateUuid()}`;
  const curveIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: connectionString }),
    );
    await prisma.onModuleInit();
    offers = new PrismaOfferRepository(prisma);
    curves = new PrismaIndexCurveRepository(prisma);
    applications = new PrismaApplicationRepository(prisma);
    await prisma.client.investmentIssuer.create({
      data: { id: issuerId, name: 'Integration Bank' },
    });
  });

  afterAll(async () => {
    try {
      const offerIds = (
        await prisma.client.investmentOffer.findMany({
          where: { issuerId },
          select: { id: true },
        })
      ).map(({ id }) => id);
      await prisma.client.investmentApplication.deleteMany({
        where: { offerSnapshotId: { in: offerIds } },
      });
      await prisma.client.investmentOffer.deleteMany({
        where: { issuerId, sourceOfferId: { not: null } },
      });
      await prisma.client.investmentOffer.deleteMany({ where: { issuerId } });
      await prisma.client.indexCurveInterval.deleteMany({
        where: { curveId: { in: curveIds } },
      });
      await prisma.client.indexCurve.deleteMany({
        where: { id: { in: curveIds } },
      });
      await prisma.client.investmentIssuer.delete({ where: { id: issuerId } });
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  function catalogOffer(kind: 'PREFIXED' | 'CDI_PERCENTAGE') {
    return Offer.create({
      titleType: TitleType.CDB,
      issuerId,
      maturityDate: CalendarDate.of('2027-01-04'),
      redemptionTerms: RedemptionTerms.create('AT_MATURITY'),
      remunerationTerms: RemunerationTerms.create(kind, Rate.of('1.05')),
    });
  }

  async function savedCdiCurve() {
    const curve = IndexCurve.create({
      name: 'Integration CDI',
      index: EconomicIndex.CDI,
      intervals: [
        IndexCurveInterval.create(
          CalendarDateRange.of(
            CalendarDate.of('2026-01-01'),
            CalendarDate.of('2026-12-31'),
          ),
          IndexValue.of('0.1415'),
        ),
      ],
    }).value;
    curveIds.push(curve.id);
    expect((await curves.save(curve)).isOk()).toBe(true);
    return curve;
  }

  async function savedSnapshot(kind: 'PREFIXED' | 'CDI_PERCENTAGE') {
    const catalog = catalogOffer(kind);
    const snapshot = catalog.createSnapshot().value;
    expect((await offers.save(catalog)).isOk()).toBe(true);
    expect((await offers.save(snapshot)).isOk()).toBe(true);
    return { catalog, snapshot };
  }

  it('round trips a snapshot with its catalog provenance and hides it from the catalog', async () => {
    const { catalog, snapshot } = await savedSnapshot('CDI_PERCENTAGE');

    const loaded = await offers.findById(snapshot.id);

    expect(loaded.value.isSnapshot).toBe(true);
    expect(loaded.value.sourceOfferId).toBe(catalog.id);
    expect(
      loaded.value.remunerationTerms.equals(snapshot.remunerationTerms),
    ).toBe(true);
    const page = await new ListOffersQueryHandler(prisma).execute({
      page: 1,
      pageSize: 100,
      q: 'Integration Bank',
    });
    const ids = page.value.items.map((item) => item.id);
    expect(ids).toContain(catalog.id);
    expect(ids).not.toContain(snapshot.id);
  });

  it('round trips an application with its curve and exact principal, then revises and deletes it', async () => {
    const curve = await savedCdiCurve();
    const { snapshot } = await savedSnapshot('CDI_PERCENTAGE');
    const principal = '1000.123456789012345678901234567891';
    const application = Application.create({
      ownerId,
      offerSnapshot: snapshot,
      indexCurve: curve,
      principal: Money.of(principal),
      investmentDate: CalendarDate.of('2026-01-02'),
    }).value;
    expect((await applications.save(application)).isOk()).toBe(true);

    const loaded = (await applications.findById(application.id, ownerId)).value;
    expect(loaded.ownerId).toBe(ownerId);
    expect(loaded.offerSnapshotId).toBe(snapshot.id);
    expect(loaded.indexCurveId).toBe(curve.id);
    expect(loaded.principal.amount.toFixed()).toBe(principal);
    expect(loaded.investmentDate.toIsoString()).toBe('2026-01-02');
    expect(
      (await applications.findById(application.id, 'someone-else')).error.code,
    ).toBe('APPLICATION_NOT_FOUND');

    const { snapshot: prefixed } = await savedSnapshot('PREFIXED');
    expect(
      loaded
        .revise({
          offerSnapshot: prefixed,
          indexCurve: null,
          principal: Money.of('2500'),
          investmentDate: CalendarDate.of('2026-02-02'),
        })
        .isOk(),
    ).toBe(true);
    expect((await applications.save(loaded)).isOk()).toBe(true);
    const revised = (await applications.findById(application.id, ownerId))
      .value;
    expect(revised.offerSnapshotId).toBe(prefixed.id);
    expect(revised.indexCurveId).toBeNull();
    expect(revised.principal.amount.toFixed()).toBe('2500');

    const deletedAt = UtcInstant.ofIso('2026-10-10T12:00:00.000Z');
    expect((await applications.save(revised.delete(deletedAt))).isOk()).toBe(
      true,
    );
    expect(
      (await applications.findById(application.id, ownerId)).error.code,
    ).toBe('APPLICATION_NOT_FOUND');
    const row = await prisma.client.investmentApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(row.deletedAt).toEqual(deletedAt.date);
  });

  it('rejects an application referencing a curve that does not exist', async () => {
    const { snapshot } = await savedSnapshot('CDI_PERCENTAGE');
    const application = Application.reconstitute({
      id: generateUuid(),
      ownerId,
      offerSnapshotId: snapshot.id,
      indexCurveId: generateUuid(),
      principal: Money.of('1000'),
      investmentDate: CalendarDate.of('2026-01-02'),
      deletedAt: null,
    });

    const result = await applications.save(application);

    expect(result.isErr()).toBe(true);
    expect(
      await prisma.client.investmentApplication.findUnique({
        where: { id: application.id },
      }),
    ).toBeNull();
  });

  it('scopes application queries to the owner and hides deleted applications', async () => {
    const curve = await savedCdiCurve();
    const { catalog, snapshot } = await savedSnapshot('CDI_PERCENTAGE');
    const queryOwner = `owner-${generateUuid()}`;
    const create = (owner: string) =>
      Application.create({
        ownerId: owner,
        offerSnapshot: snapshot,
        indexCurve: curve,
        principal: Money.of('1000.50'),
        investmentDate: CalendarDate.of('2026-01-02'),
      }).value;
    const visible = create(queryOwner);
    const deleted = create(queryOwner).delete(
      UtcInstant.ofIso('2026-10-10T00:00:00Z'),
    );
    const foreign = create(`owner-${generateUuid()}`);
    for (const application of [visible, deleted, foreign]) {
      expect((await applications.save(application)).isOk()).toBe(true);
    }

    const list = await new ListApplicationsQueryHandler(prisma).execute({
      ownerId: queryOwner,
      page: 1,
      pageSize: 20,
    });
    expect(list.value.total).toBe(1);
    expect(list.value.items).toEqual([
      {
        id: visible.id,
        principal: '1000.5',
        investmentDate: '2026-01-02',
        maturityDate: '2027-01-04',
        titleType: 'CDB',
        issuerName: 'Integration Bank',
        remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.05' },
      },
    ]);

    const get = new GetApplicationQueryHandler(prisma);
    const detail = await get.execute({
      ownerId: queryOwner,
      applicationId: visible.id,
    });
    expect(detail.value.indexCurve).toEqual({
      id: curve.id,
      name: 'Integration CDI',
    });
    expect(detail.value.offer.snapshotId).toBe(snapshot.id);
    expect(detail.value.offer.sourceOfferId).toBe(catalog.id);
    for (const [owner, id] of [
      [queryOwner, deleted.id],
      [queryOwner, foreign.id],
    ]) {
      expect(
        (await get.execute({ ownerId: owner, applicationId: id })).error.code,
      ).toBe('APPLICATION_NOT_FOUND');
    }
  });
});
