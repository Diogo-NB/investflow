import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  InvestmentProduct,
  InvestmentProductProps,
  ProductNotFoundError,
} from '@investflow/investments-domain';
import { IProductRepository } from '@investflow/investments-application';
import {
  BaseRepository,
  PrismaService,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import {
  DateRange,
  InvestmentType,
  Money,
  Rate,
  RateReferenceType,
} from '@investflow/shared-domain';
import { Indexer } from '@investflow/investments-domain';
import { ProductStatus } from '@investflow/investments-domain';
import type { InvestmentProduct as PrismaProduct } from '@prisma/client';

@Injectable()
export class ProductRepository
  extends BaseRepository<InvestmentProduct>
  implements IProductRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(id: string): Promise<InvestmentProduct | null> {
    const row = await this.prisma.client.investmentProduct.findUnique({ where: { id } });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findByIdOrThrow(id: string): Promise<InvestmentProduct> {
    const product = await this.findById(id);
    if (!product) throw new ProductNotFoundError(id);
    return product;
  }

  protected async persistAggregate(
    product: InvestmentProduct,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const data = this.toRecord(product);
    await client.investmentProduct.upsert({
      where: { id: product.id },
      create: data,
      update: data,
    });
  }

  private toRecord(product: InvestmentProduct) {
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

  private toDomain(row: PrismaProduct): InvestmentProduct {
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
}
