import { IndexCurve } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';
import { IndexCurveRepository } from './index-curve.repository';

export async function findOptionalIndexCurve(
  repository: IndexCurveRepository,
  curveId: string | null,
): Promise<Result<IndexCurve | null, AppError>> {
  return curveId ? repository.findById(curveId) : Result.ok(null);
}
