import { Module } from '@nestjs/common';
import {
  IProductRepository,
  CreateProductUseCase,
  PublishProductUseCase,
} from '@investflow/investments-application';
import { ProductRepository } from './repositories/product.repository';
import { GetProductQueryHandler } from './query-handlers/get-product/get-product.query-handler';
import { ListProductsQueryHandler } from './query-handlers/list-products/list-products.query-handler';
import { ProductsController } from './products.controller';
import { InvestmentsEventsListener } from './consumers/investments-events.listener';

@Module({
  controllers: [ProductsController],
  providers: [
    { provide: IProductRepository, useClass: ProductRepository },
    CreateProductUseCase,
    PublishProductUseCase,
    GetProductQueryHandler,
    ListProductsQueryHandler,
    InvestmentsEventsListener,
  ],
  exports: [IProductRepository],
})
export class InvestmentsInfrastructureModule {}
