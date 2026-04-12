import { Inject, Injectable } from '@nestjs/common';
import { IProductRepository, ProductNotFoundError } from '../../ports/product.repository';
import { PublishProductCommand } from './publish-product.command';

@Injectable()
export class PublishProductUseCase {
  constructor(
    @Inject(IProductRepository) private readonly productRepo: IProductRepository,
  ) {}

  async execute(command: PublishProductCommand): Promise<void> {
    const product = await this.productRepo.findByIdOrThrow(command.props.productId);

    if (product.organizationId !== command.props.organizationId) {
      throw new ProductNotFoundError(command.props.productId);
    }

    await this.productRepo.save(product.publish());
  }
}
