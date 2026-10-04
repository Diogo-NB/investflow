import Decimal from 'decimal.js';
import { DomainError } from '../foundations/domain.error';
import { Result } from '../foundations/result';
import { ValueObject } from '../foundations/value-object.base';
import { parsePositiveDecimal } from './positive-decimal';

export class InvalidRateError extends DomainError {
  constructor(reason: string, input: string) {
    super(`Invalid rate: ${reason}`, {
      code: 'INVALID_RATE',
      metadata: { reason, input },
    });
  }
}

export class Rate extends ValueObject<Rate> {
  private constructor(readonly value: Decimal) {
    super();
  }

  static create(value: Decimal.Value): Result<Rate, InvalidRateError> {
    return parsePositiveDecimal(value)
      .map((decimal) => new Rate(decimal))
      .mapError(
        (error) =>
          new InvalidRateError(
            String(error.metadata?.['reason']),
            String(error.metadata?.['input']),
          ),
      );
  }

  static of(value: Decimal.Value): Rate {
    const result = Rate.create(value);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  equals(other: Rate): boolean {
    return this.value.equals(other.value);
  }
}
