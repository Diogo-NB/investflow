import { IRepository } from '@investflow/shared-domain';
import { InvestmentProduct, ProductNotFoundError } from '@investflow/investments-domain';

export type IProductRepository = IRepository<InvestmentProduct>;

export { ProductNotFoundError };
