import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles, CurrentUser } from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import {
  CreateProductUseCase,
  CreateProductCommand,
  PublishProductUseCase,
  PublishProductCommand,
} from '@investflow/investments-application';
import { CreateProductDto } from './dtos/create-product.dto';
import {
  GetProductQueryHandler,
  GetProductQuery,
} from './query-handlers/get-product/get-product.query-handler';
import {
  ListProductsQueryHandler,
  ListProductsQuery,
} from './query-handlers/list-products/list-products.query-handler';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProductUseCase,
    private readonly publishProduct: PublishProductUseCase,
    private readonly getProductHandler: GetProductQueryHandler,
    private readonly listProductsHandler: ListProductsQueryHandler,
  ) {}

  @Post()
  @Roles('ORG_USER')
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string }> {
    const id = await this.createProduct.execute(
      new CreateProductCommand({
        organizationId: user.organizationId!,
        name: dto.name,
        type: dto.type,
        indexerType: dto.indexerType,
        indexerPercentageOfIndex: dto.indexerPercentageOfIndex,
        indexerSpread: dto.indexerSpread,
        rateValue: dto.rateValue,
        rateReferenceType: dto.rateReferenceType,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        minimumAmount: dto.minimumAmount,
        totalVolume: dto.totalVolume,
      }),
    );
    return { id };
  }

  @Patch(':id/publish')
  @Roles('ORG_USER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.publishProduct.execute(
      new PublishProductCommand({ productId: id, organizationId: user.organizationId! }),
    );
  }

  @Get(':id')
  @Roles('ORG_USER', 'INVESTOR')
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getProductHandler.execute(new GetProductQuery(id, user.organizationId!));
  }

  @Get()
  @Roles('ORG_USER', 'INVESTOR')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return this.listProductsHandler.execute(
      new ListProductsQuery(user.organizationId!, status),
    );
  }
}
