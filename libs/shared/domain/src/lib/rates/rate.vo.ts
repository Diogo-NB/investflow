import { EAppErrorCode } from '../foundations/app-error-code.enum';
import Decimal from 'decimal.js';
import { DomainError } from '../foundations/domain.error';
import { Result } from '../foundations/result';
import { ValueObject } from '../foundations/value-object.base';

export class InvalidRateError extends DomainError {
  constructor(reason: string, input: Decimal.Value) {
    super(reason, {
      code: EAppErrorCode.INVALID_RATE,
      metadata: { reason, input: String(input) },
    });
  }
}

export class Rate extends ValueObject<Rate> {
  private constructor(readonly value: Decimal) {
    super();
  }

  static create(value: Decimal.Value): Result<Rate, InvalidRateError> {
    let decimal: Decimal;
    try {
      decimal = new Decimal(value);
    } catch {
      return Result.err(
        new InvalidRateError('Informe um número válido.', value),
      );
    }
    if (!decimal.isFinite()) {
      return Result.err(
        new InvalidRateError('Informe um número finito.', value),
      );
    }
    if (decimal.lessThanOrEqualTo(0)) {
      return Result.err(
        new InvalidRateError('A taxa deve ser maior que zero.', value),
      );
    }
    return Result.ok(new Rate(decimal));
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
