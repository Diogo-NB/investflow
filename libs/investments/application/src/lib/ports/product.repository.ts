import { InvestmentProduct, ProductNotFoundError } from '@investflow/investments-domain';

export abstract class IProductRepository {
  abstract findById(id: string): Promise<InvestmentProduct | null>;
  abstract findByIdOrThrow(id: string): Promise<InvestmentProduct>;
  abstract save(aggregate: InvestmentProduct): Promise<void>;
  abstract findAllByOrganization(organizationId: string): Promise<InvestmentProduct[]>;
}

export { ProductNotFoundError };
