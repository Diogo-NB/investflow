import { Offer } from '../models/offer.type';
import {
  isCalendarDate,
  modelChanged,
  offerToModel,
  percentageToRate,
  rateToPercentage,
  toCreateOffer,
  toUpdateOffer,
} from './offer-values';
const original: Offer = {
  id: 'offer-id',
  titleType: 'CDB',
  issuer: { id: 'issuer-id', name: 'Banco Local' },
  maturityDate: '2028-12-31',
  redemptionTerms: { kind: 'DAILY' },
  remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.10' },
};
describe('Offer values', () => {
  it.each([
    ['110', '1.1'],
    ['12,5', '0.125'],
    ['0006.00', '0.06'],
    ['.5', '0.005'],
    ['0.0000000000000000000000000001', '0.000000000000000000000000000001'],
    ['105.1234567890123456789012345678', '1.051234567890123456789012345678'],
  ])('converts %s without floating point rounding', (input, rate) => {
    expect(percentageToRate(input)).toBe(rate);
    expect(percentageToRate(rateToPercentage(rate))).toBe(rate);
  });
  it.each([
    '',
    '0',
    '-2',
    'NaN',
    'Infinity',
    '1e2',
    '1.000,50',
    '0.00000000000000000000000000001',
    '9'.repeat(38),
  ])('rejects invalid or unrepresentable percentage %s', (value) =>
    expect(percentageToRate(value)).toBeUndefined(),
  );
  it.each([
    ['2024-02-29', true],
    ['2025-02-29', false],
    ['2000-02-29', true],
    ['1900-02-29', false],
    ['0001-01-01', true],
    ['0000-01-01', false],
    ['2028-04-31', false],
    ['2028-13-01', false],
    ['2028-12-31', true],
  ])('validates calendar day %s without timezone shifts', (value, expected) =>
    expect(isCalendarDate(value)).toBe(expected),
  );
  it('builds the create contract and ignores formatting-only edits', () => {
    const model = offerToModel(original);
    expect(toCreateOffer(model)).toEqual({
      titleType: 'CDB',
      issuerId: 'issuer-id',
      maturityDate: '2028-12-31',
      redemptionTerms: { kind: 'DAILY' },
      remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
    });
    expect(
      toUpdateOffer({ ...model, percentage: '110.000' }, original),
    ).toEqual({});
    expect(modelChanged({ ...model, percentage: '110.000' }, model)).toBe(
      false,
    );
  });
  it('patches only changed mutable fields and sends whole changed terms', () => {
    const patch = toUpdateOffer(
      {
        ...offerToModel(original),
        titleType: 'LCI',
        issuerId: 'other',
        maturityDate: '2029-01-02',
        remunerationKind: 'IPCA_PLUS',
        percentage: '6',
      },
      original,
    );
    expect(patch).toEqual({
      maturityDate: '2029-01-02',
      remunerationTerms: { kind: 'IPCA_PLUS', rate: '0.06' },
    });
  });
});
