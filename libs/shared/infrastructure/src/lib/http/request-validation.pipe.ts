import { EAppErrorCode } from '@investflow/shared-domain';
import {
  BadRequestException,
  HttpStatus,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';

export interface InvalidRequestField {
  // Dotted path in the request body, such as `remunerationTerms.rate`.
  readonly field: string;
  readonly constraints: readonly string[];
}

function invalidFields(
  errors: readonly ValidationError[],
  parent?: string,
): InvalidRequestField[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [{ field, constraints: Object.keys(error.constraints) }]
      : [];
    return [...own, ...invalidFields(error.children ?? [], field)];
  });
}

/** Malformed requests answer 400 in the same envelope as `AppExceptionFilter`. */
export function requestValidationException(
  errors: readonly ValidationError[],
): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: EAppErrorCode.REQUEST_INVALID,
    message: 'Dados inválidos. Revise os campos.',
    details: { fields: invalidFields(errors) },
  });
}

export function createRequestValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) => requestValidationException(errors),
  });
}
