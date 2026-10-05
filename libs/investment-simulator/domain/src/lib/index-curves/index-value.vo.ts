import { DomainError, Result, ValueObject } from '@investflow/shared-domain';
import Decimal from 'decimal.js';

export class InvalidIndexValueError extends DomainError {
  constructor(reason: string) {
    super(`Invalid index value: ${reason}`, { code: 'INVALID_INDEX_VALUE' });
  }
}

export class IndexValue extends ValueObject<IndexValue> {
  private constructor(readonly value: Decimal) {
    super();
  }

  static create(
    value: Decimal.Value,
  ): Result<IndexValue, InvalidIndexValueError> {
    return Result.fromThrowable(
      () => new Decimal(value),
      () => new InvalidIndexValueError('expected a decimal'),
    ).andThen((decimal) => {
      if (!decimal.isFinite() || decimal.lessThanOrEqualTo(-1)) {
        return Result.err(
          new InvalidIndexValueError(
            'value must be finite and greater than -1',
          ),
        );
      }
      return Result.ok(new IndexValue(decimal));
    });
  }

  static of(value: Decimal.Value): IndexValue {
    const result = IndexValue.create(value);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  equals(other: IndexValue): boolean {
    return this.value.equals(other.value);
  }
}
