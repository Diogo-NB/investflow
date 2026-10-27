import { AggregateRoot, EAppErrorCode } from '@investflow/shared-domain';
import { RepositoryFindError, RepositorySaveError } from '../repository.error';

class TestAggregate extends AggregateRoot {
  constructor() {
    super('aggregate-id');
  }
}

describe('repository errors', () => {
  const cause = new Error('database failed');

  it('describes a save failure', () => {
    const error = new RepositorySaveError(new TestAggregate(), cause);

    expect(error.code).toBe(EAppErrorCode.REPOSITORY_SAVE_FAILED);
    expect(error.kind).toBe('infrastructure');
    expect(error.metadata).toEqual({
      aggregateId: 'aggregate-id',
      aggregateType: 'TestAggregate',
    });
    expect(error.cause).toBe(cause);
  });

  it('describes a find failure', () => {
    const error = new RepositoryFindError('Offer', 'offer-id', cause);

    expect(error.code).toBe(EAppErrorCode.REPOSITORY_FIND_FAILED);
    expect(error.kind).toBe('infrastructure');
    expect(error.metadata).toEqual({
      aggregateType: 'Offer',
      aggregateId: 'offer-id',
    });
    expect(error.cause).toBe(cause);
  });
});
