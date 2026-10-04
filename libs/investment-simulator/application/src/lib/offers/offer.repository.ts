import { Offer } from '@investflow/investment-simulator-domain';
import { Repository } from '@investflow/shared-domain';

export abstract class OfferRepository extends Repository<Offer> {}
