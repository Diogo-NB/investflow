import Decimal from 'decimal.js';
import type { InvestmentProduct as PrismaProduct } from '@prisma/client';
import {
  DateRange,
  InvestmentType,
  Money,
  Rate,
  RateReferenceType,
} from '@investflow/shared-domain';
import {
  InvestmentProduct,
  InvestmentProductProps,
  Indexer,
  ProductStatus,
} from '@investflow/investments-domain';

export class InvestmentProductMapper {
  static toDomain(row: PrismaProduct): InvestmentProduct {
    const props: InvestmentProductProps = {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      type: row.type as InvestmentType,
      indexer: Indexer.of(
        row.indexerType as InvestmentType,
        row.indexerPct !== null ? new Decimal(row.indexerPct.toString()) : undefined,
        row.indexerSpread !== null ? new Decimal(row.indexerSpread.toString()) : undefined,
      ),
      rate: Rate.of(new Decimal(row.rateValue.toString()), row.rateRefType as RateReferenceType),
      period: DateRange.of(row.startDate, row.endDate),
      minimumAmount: Money.of(new Decimal(row.minimumAmount.toString())),
      totalVolume: Money.of(new Decimal(row.totalVolume.toString())),
      status: row.status as ProductStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return InvestmentProduct.reconstitute(props);
  }

  static toPersistence(product: InvestmentProduct) {
    return {
      id: product.id,
      organizationId: product.organizationId,
      name: product.name,
      type: product.type,
      indexerType: product.indexer.type,
      indexerPct: product.indexer.percentageOfIndex ?? null,
      indexerSpread: product.indexer.spread ?? null,
      rateValue: product.rate.value,
      rateRefType: product.rate.referenceType,
      startDate: product.period.start,
      endDate: product.period.end,
      minimumAmount: product.minimumAmount.amount,
      totalVolume: product.totalVolume.amount,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.getUpdatedAt(),
    };
  }
}
