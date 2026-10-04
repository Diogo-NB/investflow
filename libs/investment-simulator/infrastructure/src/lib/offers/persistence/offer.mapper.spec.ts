import {
  RemunerationTerms,
  Offer,
  TitleType,
  RedemptionTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate, UtcInstant } from '@investflow/shared-domain';
import {
  InvestmentOffer,
  InvestmentRedemptionType,
  InvestmentRemunerationType,
  InvestmentTitleType,
  Prisma,
} from '@prisma/client';
import { OfferMapper } from './offer.mapper';

const ID = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const ISSUER_ID = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';

function persistenceRecord(
  overrides: Partial<InvestmentOffer> = {},
): InvestmentOffer {
  return {
    id: ID,
    titleType: InvestmentTitleType.CDB,
    issuerId: ISSUER_ID,
    maturityDate: new Date('2030-05-20T00:00:00.000Z'),
    redemptionType: InvestmentRedemptionType.AT_MATURITY,
    remunerationType: InvestmentRemunerationType.PREFIXED,
    rateValue: new Prisma.Decimal('12.345678901234567890123456789'),
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-02-01T00:00:00Z'),
    ...overrides,
  };
}

describe('OfferMapper', () => {
  it.each([
    [InvestmentTitleType.CDB, TitleType.CDB],
    [InvestmentTitleType.LCI, TitleType.LCI],
    [InvestmentTitleType.LCA, TitleType.LCA],
  ] as const)('round trips title type %s', (persisted, domain) => {
    const offer = OfferMapper.toDomain(
      persistenceRecord({ titleType: persisted }),
    );

    expect(offer.titleType).toBe(domain);
    expect(OfferMapper.toPersistence(offer).titleType).toBe(persisted);
  });

  it.each([
    InvestmentRedemptionType.AT_MATURITY,
    InvestmentRedemptionType.DAILY,
  ])('round trips redemption type %s', (redemptionType) => {
    const offer = OfferMapper.toDomain(persistenceRecord({ redemptionType }));

    expect(offer.redemptionTerms.kind).toBe(redemptionType);
    expect(OfferMapper.toPersistence(offer).redemptionType).toBe(
      redemptionType,
    );
  });

  it.each(Object.values(InvestmentRemunerationType))(
    'round trips remuneration %s and its rate',
    (remunerationType) => {
      const offer = OfferMapper.toDomain(
        persistenceRecord({ remunerationType }),
      );
      const terms = offer.remunerationTerms;

      expect(terms.kind).toBe(remunerationType);
      expect(terms.rate.value.toString()).toBe(
        '12.345678901234567890123456789',
      );
      expect(OfferMapper.toPersistence(offer)).toMatchObject({
        remunerationType,
        rateValue: '12.345678901234567890123456789',
      });
    },
  );

  it('preserves the civil maturity date and deletion instant', () => {
    const deletedAt = new Date('2026-09-27T15:34:56.789Z');
    const offer = OfferMapper.toDomain(persistenceRecord({ deletedAt }));

    expect(offer.maturityDate.toIsoString()).toBe('2030-05-20');
    expect(offer.deletedAt?.toISOString()).toBe(deletedAt.toISOString());
    expect(OfferMapper.toPersistence(offer)).toMatchObject({
      maturityDate: new Date('2030-05-20T00:00:00.000Z'),
      deletedAt,
    });
    expect(offer).not.toHaveProperty('createdAt');
    expect(offer).not.toHaveProperty('updatedAt');
  });

  it('maps a domain offer without converting its rate through number', () => {
    const offer = Offer.reconstitute({
      id: ID,
      titleType: TitleType.CDB,
      issuerId: ISSUER_ID,
      maturityDate: CalendarDate.of('2030-05-20'),
      redemptionTerms: RedemptionTerms.create('DAILY'),
      remunerationTerms: RemunerationTerms.create(
        'IPCA_PLUS',
        Rate.of('7.500000000000000000000000000001'),
      ),
      deletedAt: UtcInstant.ofIso('2026-09-27T15:34:56.789Z'),
    });

    expect(OfferMapper.toPersistence(offer).rateValue).toBe(
      '7.500000000000000000000000000001',
    );
  });

  it('throws for an invalid persisted rate', () => {
    expect(() =>
      OfferMapper.toDomain(
        persistenceRecord({ rateValue: new Prisma.Decimal(0) }),
      ),
    ).toThrow();
  });
});
