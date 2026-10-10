import { Application } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';

export abstract class ApplicationRepository {
  // Scoped to the owner: another owner's application is reported as missing.
  abstract findById(
    id: string,
    ownerId: string,
  ): Promise<Result<Application, AppError>>;

  abstract save(application: Application): Promise<Result<void, AppError>>;
}
