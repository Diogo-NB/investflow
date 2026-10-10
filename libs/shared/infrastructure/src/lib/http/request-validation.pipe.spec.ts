import { EAppErrorCode } from '@investflow/shared-domain';
import type { ValidationError } from '@nestjs/common';
import { requestValidationException } from './request-validation.pipe';

function validationError(
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError {
  return { property, constraints, children };
}

describe('requestValidationException', () => {
  it('lists every invalid field by its dotted path in the error envelope', () => {
    const exception = requestValidationException([
      validationError('principal', { isDecimal: 'principal must be decimal' }),
      validationError('remunerationTerms', undefined, [
        validationError('rate', {
          isDefined: 'rate should not be null',
          isDecimal: 'rate must be decimal',
        }),
      ]),
    ]);

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      statusCode: 400,
      code: EAppErrorCode.REQUEST_INVALID,
      message: 'Dados inválidos. Revise os campos.',
      details: {
        fields: [
          { field: 'principal', constraints: ['isDecimal'] },
          {
            field: 'remunerationTerms.rate',
            constraints: ['isDefined', 'isDecimal'],
          },
        ],
      },
    });
  });
});
