import { Application } from '@investflow/investment-simulator-domain';
import { AppError, Result } from '@investflow/shared-domain';
import { ApplicationNotFoundError } from '../application-not-found.error';
import { ApplicationRepository } from '../application.repository';

// Another owner's application is reported exactly like a missing one.
export async function findOwnedApplication(
  repository: ApplicationRepository,
  applicationId: string,
  ownerId: string,
): Promise<Result<Application, AppError>> {
  const result = await repository.findById(applicationId);
  if (result.isErr()) return result;
  return result.value.ownerId === ownerId
    ? result
    : Result.err(new ApplicationNotFoundError(applicationId));
}
