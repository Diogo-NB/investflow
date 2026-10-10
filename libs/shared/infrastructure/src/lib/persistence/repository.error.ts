import {
  AggregateRoot,
  AppError,
  EAppErrorCode,
} from '@investflow/shared-domain';

export class RepositorySaveError extends AppError {
  constructor(aggregate: AggregateRoot, cause: unknown) {
    super('Não foi possível salvar os dados.', {
      code: EAppErrorCode.REPOSITORY_SAVE_FAILED,
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
    super('Não foi possível carregar os dados.', {
      code: EAppErrorCode.REPOSITORY_FIND_FAILED,
      kind: 'infrastructure',
      metadata: { aggregateType, aggregateId },
      cause,
    });
  }
}
