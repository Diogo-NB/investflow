import Decimal from 'decimal.js';
import { Rate, InvalidRateError } from './rate.vo';
import { RateReferenceType } from '../rate-reference-type/rate-reference-type.enum';

describe('Rate', () => {
  describe('Rate.of()', () => {
    it('creates a Rate from a positive Decimal', () => {
      const rate = Rate.of(new Decimal('0.12'), RateReferenceType.PERCENTAGE_CDI);
      expect(rate.value.toString()).toBe('0.12');
      expect(rate.referenceType).toBe(RateReferenceType.PERCENTAGE_CDI);
    });

    it('creates a Rate from a positive number', () => {
      const rate = Rate.of(5, RateReferenceType.FIXED);
      expect(rate.value.toNumber()).toBe(5);
    });

    it('creates a Rate from a positive string', () => {
      const rate = Rate.of('3.75', RateReferenceType.IPCA_PLUS);
      expect(rate.value.toString()).toBe('3.75');
    });

    it('throws InvalidRateError for zero', () => {
      expect(() => Rate.of(0, RateReferenceType.FIXED)).toThrow(InvalidRateError);
    });

    it('throws InvalidRateError for negative values', () => {
      expect(() => Rate.of(-1, RateReferenceType.FIXED)).toThrow(InvalidRateError);
    });

    it('throws InvalidRateError for negative Decimal', () => {
      expect(() => Rate.of(new Decimal('-0.01'), RateReferenceType.PERCENTAGE_CDI)).toThrow(InvalidRateError);
    });
  });

  describe('equals()', () => {
    it('returns true when value and referenceType match', () => {
      const a = Rate.of('0.12', RateReferenceType.PERCENTAGE_CDI);
      const b = Rate.of('0.12', RateReferenceType.PERCENTAGE_CDI);
      expect(a.equals(b)).toBe(true);
    });

    it('returns false when values differ', () => {
      const a = Rate.of('0.12', RateReferenceType.PERCENTAGE_CDI);
      const b = Rate.of('0.13', RateReferenceType.PERCENTAGE_CDI);
      expect(a.equals(b)).toBe(false);
    });

    it('returns false when referenceTypes differ', () => {
      const a = Rate.of('0.12', RateReferenceType.PERCENTAGE_CDI);
      const b = Rate.of('0.12', RateReferenceType.FIXED);
      expect(a.equals(b)).toBe(false);
    });
  });
});
