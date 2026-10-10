import { ETitleType } from '@investflow/investment-simulator-domain';
import {
  InvalidCalendarDateError,
  InvalidRateError,
} from '@investflow/shared-domain';
import { CreateOfferCommand } from './create-offer.command';

const ISSUER_ID = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';

describe('CreateOfferCommand', () => {
  it.each([
    { kind: 'PREFIXED' as const, rate: '12' },
    { kind: 'CDI_PERCENTAGE' as const, rate: '105' },
    { kind: 'SELIC_PERCENTAGE' as const, rate: '95' },
    { kind: 'IPCA_PLUS' as const, rate: '7.5' },
  ])('creates $kind terms from a request', (remunerationTerms) => {
    const command = CreateOfferCommand.fromRequest({
      titleType: ETitleType.CDB,
      issuerId: ISSUER_ID,
      maturityDate: '2030-05-20',
      redemptionTerms: { kind: 'AT_MATURITY' },
      remunerationTerms,
    });

    expect(command.maturityDate.toIsoString()).toBe('2030-05-20');
    expect(command.redemptionTerms.kind).toBe('AT_MATURITY');
    expect(command.remunerationTerms.kind).toBe(remunerationTerms.kind);
    expect(command.remunerationTerms.contractRate.value.toString()).toBe(
      remunerationTerms.rate,
    );
  });

  it('preserves decimal precision', () => {
    const command = CreateOfferCommand.fromRequest({
      titleType: ETitleType.LCI,
      issuerId: ISSUER_ID,
      maturityDate: '2030-05-20',
      redemptionTerms: { kind: 'DAILY' },
      remunerationTerms: {
        kind: 'CDI_PERCENTAGE',
        rate: '105.12345678901234567890123456789',
      },
    });

    expect(command.remunerationTerms.kind).toBe('CDI_PERCENTAGE');
    expect(command.remunerationTerms.contractRate.value.toString()).toBe(
      '105.12345678901234567890123456789',
    );
  });

  it('rejects invalid dates and rates', () => {
    expect(() =>
      CreateOfferCommand.fromRequest({
        titleType: ETitleType.LCA,
        issuerId: ISSUER_ID,
        maturityDate: 'not-a-date',
        redemptionTerms: { kind: 'DAILY' },
        remunerationTerms: { kind: 'PREFIXED', rate: '12' },
      }),
    ).toThrow(InvalidCalendarDateError);

    expect(() =>
      CreateOfferCommand.fromRequest({
        titleType: ETitleType.LCA,
        issuerId: ISSUER_ID,
        maturityDate: '2030-05-20',
        redemptionTerms: { kind: 'DAILY' },
        remunerationTerms: { kind: 'PREFIXED', rate: 'invalid' },
      }),
    ).toThrow(InvalidRateError);
  });
});
