import { Injectable } from '@nestjs/common';
import { InvestmentProduct, ProductNotFoundError } from '@investflow/investments-domain';
import { IProductRepository } from '@investflow/investments-application';
import {
  BaseRepository,
  PrismaService,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { InvestmentProductMapper } from '../mappers/investment-product.mapper';

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
    return InvestmentProductMapper.toDomain(row);
  }

  async findByIdOrThrow(id: string): Promise<InvestmentProduct> {
    const product = await this.findById(id);
    if (!product) throw new ProductNotFoundError(id);
    return product;
  }

  async findAllByOrganization(organizationId: string): Promise<InvestmentProduct[]> {
    const rows = await this.prisma.client.investmentProduct.findMany({
      where: { organizationId },
    });
    return rows.map(InvestmentProductMapper.toDomain);
  }

  protected async persistAggregate(
    product: InvestmentProduct,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const data = InvestmentProductMapper.toPersistence(product);
    await client.investmentProduct.upsert({
      where: { id: product.id },
      create: data,
      update: data,
    });
  }
}
