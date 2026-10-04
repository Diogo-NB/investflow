import { AggregateRoot, AppError } from '@investflow/shared-domain';

export class RepositorySaveError extends AppError {
  constructor(aggregate: AggregateRoot, cause: unknown) {
    super(`Failed to save ${aggregate.constructor.name}`, {
      code: 'REPOSITORY_SAVE_FAILED',
      kind: 'infrastructure',
      metadata: {
        aggregateId: aggregate.id,
        aggregateType: aggregate.constructor.name,
      },
      cause,
    });
  }
}

export class RepositoryFindError extends AppError {
  constructor(aggregateType: string, aggregateId: string, cause: unknown) {
    super(`Failed to find ${aggregateType}`, {
      code: 'REPOSITORY_FIND_FAILED',
      kind: 'infrastructure',
      metadata: { aggregateType, aggregateId },
      cause,
    });
  }
}
