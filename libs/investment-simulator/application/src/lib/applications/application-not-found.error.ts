import { NotFoundError } from '@investflow/shared-domain';

export class ApplicationNotFoundError extends NotFoundError {
  constructor(applicationId: string) {
    super(`Application ${applicationId} was not found`, {
      code: 'APPLICATION_NOT_FOUND',
      metadata: { applicationId },
    });
  }
}
