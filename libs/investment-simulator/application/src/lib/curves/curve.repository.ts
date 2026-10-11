import { Curve } from '@investflow/investment-simulator-domain';
import { Repository } from '@investflow/shared-domain';

// A deleted curve is reported as missing.
export abstract class CurveRepository extends Repository<Curve> {}
