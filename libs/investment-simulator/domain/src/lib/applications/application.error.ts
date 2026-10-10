import { AppErrorMetadata, DomainError } from '@investflow/shared-domain';

export class InvalidApplicationError extends DomainError {
  constructor(reason: string, metadata?: AppErrorMetadata) {
    super(`Invalid application: ${reason}`, {
      code: 'INVALID_APPLICATION',
      metadata: { ...metadata, reason },
    });
  }
}

export class ApplicationDeletedError extends DomainError {
  constructor(applicationId: string) {
    super('Deleted applications cannot be revised', {
      code: 'APPLICATION_DELETED',
      kind: 'conflict',
      metadata: { applicationId },
    });
  }
}
