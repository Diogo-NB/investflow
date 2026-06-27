import Decimal from 'decimal.js';
import { DomainError } from '../../errors/domain.error';
import { Result } from '../../result/result';
import { RateReferenceType } from '../rate-reference-type/rate-reference-type.enum';
import { ValueObject } from '../value-object.base';

export class InvalidRateError extends DomainError {
  constructor(value: Decimal) {
    super(`Rate value must be greater than zero, got: ${value.toString()}`);
  }
}

export class Rate extends ValueObject<Rate> {
  private constructor(
    readonly value: Decimal,
    readonly referenceType: RateReferenceType,
  ) {
    super();
  }

  static create(
    value: Decimal | number | string,
    referenceType: RateReferenceType,
  ): Result<Rate, InvalidRateError> {
    const decimal = new Decimal(value);
    if (decimal.lessThanOrEqualTo(0)) {
      return Result.err(new InvalidRateError(decimal));
    }

    return Result.ok(new Rate(decimal, referenceType));
  }

  static of(
    value: Decimal | number | string,
    referenceType: RateReferenceType,
  ): Rate {
    const result = Rate.create(value, referenceType);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  equals(other: Rate): boolean {
    return (
      this.value.equals(other.value) &&
      this.referenceType === other.referenceType
    );
  }
}
