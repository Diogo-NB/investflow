import Decimal from 'decimal.js';
import { DomainError } from '../foundations/domain.error';
import { Result } from '../foundations/result';

export class InvalidPositiveDecimalError extends DomainError {
  constructor(reason: string, input: string) {
    super(`Invalid positive decimal: ${reason}`, {
      code: 'INVALID_POSITIVE_DECIMAL',
      metadata: { reason, input },
    });
  }
}

export function parsePositiveDecimal(
  value: Decimal.Value,
): Result<Decimal, InvalidPositiveDecimalError> {
  const input = serializeDecimalInput(value);
  let decimal: Decimal;

  try {
    decimal = new Decimal(value);
  } catch {
    return Result.err(
      new InvalidPositiveDecimalError('value must be a valid decimal', input),
    );
  }

  if (!decimal.isFinite()) {
    return Result.err(
      new InvalidPositiveDecimalError('value must be finite', input),
    );
  }

  if (decimal.lessThanOrEqualTo(0)) {
    return Result.err(
      new InvalidPositiveDecimalError('value must be greater than zero', input),
    );
  }

  return Result.ok(decimal);
}

function serializeDecimalInput(value: Decimal.Value): string {
  try {
    return String(value);
  } catch {
    return '<unprintable>';
  }
}
