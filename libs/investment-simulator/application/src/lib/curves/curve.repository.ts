import { Curve, EEconomicIndex } from '@investflow/investment-simulator-domain';
import { AppError, Repository, Result } from '@investflow/shared-domain';

// A deleted curve is reported as missing.
export abstract class CurveRepository extends Repository<Curve> {
  abstract findSystemCurve(
    index: EEconomicIndex,
    name: string,
  ): Promise<Result<Curve, AppError>>;
}
