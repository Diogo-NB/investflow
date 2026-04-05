import Decimal from 'decimal.js';
import { DomainError } from '../../errors/domain.error';
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

  static of(value: Decimal | number | string, referenceType: RateReferenceType): Rate {
    const decimal = new Decimal(value);
    if (decimal.lessThanOrEqualTo(0)) throw new InvalidRateError(decimal);
    return new Rate(decimal, referenceType);
  }

  equals(other: Rate): boolean {
    return this.value.equals(other.value) && this.referenceType === other.referenceType;
  }
}
