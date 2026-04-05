import { DateRange, InvalidDateRangeError, InvestmentType, Money, Rate, RateReferenceType } from '@investflow/shared-domain';
import {
  InvalidIndexerError,
  InvalidProductTransitionError,
  ProductNotOpenError,
} from '../../errors/product-domain.errors';
import { ProductClosedEvent } from '../../events/product-closed.event';
import { ProductPublishedEvent } from '../../events/product-published.event';
import { Indexer } from '../../value-objects/indexer/indexer.vo';
import { ProductStatus } from '../../value-objects/product-status/product-status.enum';
import { InvestmentProduct } from './investment-product.aggregate';

const startDate = new Date('2025-01-01');
const endDate = new Date('2026-01-01');

function makeProduct(overrides: Partial<Parameters<typeof InvestmentProduct.create>[0]> = {}) {
  return InvestmentProduct.create({
    organizationId: 'org-1',
    name: 'Tesouro SELIC 2026',
    type: InvestmentType.SELIC,
    indexer: Indexer.of(InvestmentType.SELIC),
    rate: Rate.of(12.5, RateReferenceType.FIXED),
    period: DateRange.of(startDate, endDate),
    minimumAmount: Money.of(100),
    totalVolume: Money.of(1_000_000),
    ...overrides,
  });
}

describe('InvestmentProduct', () => {
  describe('create()', () => {
    it('returns aggregate with status DRAFT and raises no events', () => {
      const product = makeProduct();
      expect(product.status).toBe(ProductStatus.DRAFT);
      expect(product.getDomainEvents()).toHaveLength(0);
    });

    it('throws InvalidIndexerError when SELIC receives a percentageOfIndex', () => {
      expect(() =>
        Indexer.of(InvestmentType.SELIC, 110),
      ).toThrow(InvalidIndexerError);
    });

    it('throws InvalidIndexerError when CDI has no percentageOfIndex', () => {
      expect(() =>
        Indexer.of(InvestmentType.CDI),
      ).toThrow(InvalidIndexerError);
    });

    it('throws InvalidIndexerError when IPCA has no spread', () => {
      expect(() =>
        Indexer.of(InvestmentType.IPCA),
      ).toThrow(InvalidIndexerError);
    });

    it('throws InvalidDateRangeError when end <= start', () => {
      expect(() =>
        DateRange.of(endDate, startDate),
      ).toThrow(InvalidDateRangeError);
    });

    it('throws InvalidDateRangeError when end equals start', () => {
      expect(() =>
        DateRange.of(startDate, startDate),
      ).toThrow(InvalidDateRangeError);
    });
  });

  describe('publish()', () => {
    it('transitions DRAFT → OPEN and raises ProductPublishedEvent', () => {
      const product = makeProduct();
      product.publish();
      expect(product.status).toBe(ProductStatus.OPEN);
      const events = product.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ProductPublishedEvent);
    });

    it('throws InvalidProductTransitionError when product is already OPEN', () => {
      const product = makeProduct();
      product.publish();
      expect(() => product.publish()).toThrow(InvalidProductTransitionError);
    });

    it('throws InvalidProductTransitionError when product is CLOSED', () => {
      const product = makeProduct();
      product.publish();
      product.close();
      expect(() => product.publish()).toThrow(InvalidProductTransitionError);
    });
  });

  describe('validateAcceptsOrders()', () => {
    it('does not throw when product is OPEN', () => {
      const product = makeProduct();
      product.publish();
      expect(() => product.validateAcceptsOrders()).not.toThrow();
    });

    it('throws ProductNotOpenError when product is DRAFT', () => {
      const product = makeProduct();
      expect(() => product.validateAcceptsOrders()).toThrow(ProductNotOpenError);
    });

    it('throws ProductNotOpenError when product is CLOSED', () => {
      const product = makeProduct();
      product.publish();
      product.close();
      expect(() => product.validateAcceptsOrders()).toThrow(ProductNotOpenError);
    });
  });

  describe('close()', () => {
    it('transitions OPEN → CLOSED and raises ProductClosedEvent', () => {
      const product = makeProduct();
      product.publish();
      product.clearDomainEvents();
      product.close();
      expect(product.status).toBe(ProductStatus.CLOSED);
      const events = product.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ProductClosedEvent);
    });

    it('throws InvalidProductTransitionError when product is DRAFT', () => {
      const product = makeProduct();
      expect(() => product.close()).toThrow(InvalidProductTransitionError);
    });

    it('throws InvalidProductTransitionError when product is already CLOSED', () => {
      const product = makeProduct();
      product.publish();
      product.close();
      expect(() => product.close()).toThrow(InvalidProductTransitionError);
    });
  });

  describe('CDI and IPCA indexers', () => {
    it('creates a CDI product with valid percentageOfIndex', () => {
      const product = makeProduct({
        type: InvestmentType.CDI,
        indexer: Indexer.of(InvestmentType.CDI, 110),
      });
      expect(product.indexer.percentageOfIndex?.toNumber()).toBe(110);
    });

    it('creates an IPCA product with valid spread', () => {
      const product = makeProduct({
        type: InvestmentType.IPCA,
        indexer: Indexer.of(InvestmentType.IPCA, undefined, 5.5),
      });
      expect(product.indexer.spread?.toNumber()).toBe(5.5);
    });
  });
});
