import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import {
  AppError,
  ConflictError,
  DomainError,
  EAppErrorCode,
  NotFoundError,
} from '@investflow/shared-domain';
import { AppExceptionFilter } from './app-exception.filter';

interface ResponseMock {
  status: jest.Mock<{ json: jest.Mock<void, [unknown]> }, [number]>;
  json: jest.Mock<void, [unknown]>;
}

function createHost(response: ResponseMock): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: jest.fn().mockReturnValue(response),
      getRequest: jest.fn(),
      getNext: jest.fn(),
    }),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  } satisfies ArgumentsHost;
}

function createResponse(): ResponseMock {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  } as ResponseMock;

  response.status.mockReturnValue({ json: response.json });

  return response;
}

describe('AppExceptionFilter', () => {
  let filter: AppExceptionFilter;

  beforeEach(() => {
    filter = new AppExceptionFilter();
  });

  it('maps validation errors to 422 with the standard envelope', () => {
    const response = createResponse();
    const error = new DomainError('Invalid input', {
      code: EAppErrorCode.INVESTMENT_PERIOD_INVALID,
      metadata: { field: 'amount' },
    });

    filter.catch(error, createHost(response));

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      code: EAppErrorCode.INVESTMENT_PERIOD_INVALID,
      message: 'Invalid input',
      details: { field: 'amount' },
    });
  });

  it('maps not found and conflict errors', () => {
    const notFoundResponse = createResponse();
    const conflictResponse = createResponse();

    filter.catch(
      new NotFoundError('Não encontrado.', {
        code: EAppErrorCode.OFFER_NOT_FOUND,
      }),
      createHost(notFoundResponse),
    );
    filter.catch(
      new ConflictError('Conflito.', {
        code: EAppErrorCode.SIMULATION_DELETED,
      }),
      createHost(conflictResponse),
    );

    expect(notFoundResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(conflictResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('maps infrastructure errors to 500 without exposing their message', () => {
    const response = createResponse();
    const error = new AppError('Database failed', {
      code: EAppErrorCode.REPOSITORY_SAVE_FAILED,
      kind: 'infrastructure',
    });

    filter.catch(error, createHost(response));

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: EAppErrorCode.REPOSITORY_SAVE_FAILED,
      message: 'Não foi possível concluir agora. Tente novamente.',
      details: {},
    });
  });
});
