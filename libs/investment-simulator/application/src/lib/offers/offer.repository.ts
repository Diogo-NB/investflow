import { Offer } from '@investflow/investment-simulator-domain';
import { Repository } from '@investflow/shared-domain';

// A deleted offer is reported as missing.
export abstract class OfferRepository extends Repository<Offer> {}
