import { Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { DateRange, Money, Rate } from '@investflow/shared-domain';
import { InvestmentProduct, Indexer } from '@investflow/investments-domain';
import { IProductRepository } from '../../ports/product.repository';
import { CreateProductCommand } from './create-product.command';

@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(IProductRepository)
    private readonly productRepo: IProductRepository,
  ) {}

  async execute(command: CreateProductCommand): Promise<string> {
    const product = InvestmentProduct.create({
      organizationId: command.organizationId,
      name: command.name,
      type: command.type,
      indexer: Indexer.of(
        command.indexerType,
        command.indexerPercentageOfIndex,
        command.indexerSpread,
      ),
      rate: Rate.of(new Decimal(command.rateValue), command.rateReferenceType),
      period: DateRange.of(command.startDate, command.endDate),
      minimumAmount: Money.of(new Decimal(command.minimumAmount)),
      totalVolume: Money.of(new Decimal(command.totalVolume)),
    });

    await this.productRepo.save(product);
    return product.id;
  }
}
