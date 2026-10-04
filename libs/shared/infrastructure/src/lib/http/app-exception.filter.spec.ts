import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import {
  AppError,
  ConflictError,
  DomainError,
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
      getResponse: () => response,
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
      code: 'INVALID_INPUT',
      metadata: { field: 'amount' },
    });

    filter.catch(error, createHost(response));

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'INVALID_INPUT',
      message: 'Invalid input',
      details: { field: 'amount' },
    });
  });

  it('maps not found and conflict errors', () => {
    const notFoundResponse = createResponse();
    const conflictResponse = createResponse();

    filter.catch(new NotFoundError(), createHost(notFoundResponse));
    filter.catch(new ConflictError(), createHost(conflictResponse));

    expect(notFoundResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(conflictResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('maps infrastructure errors to 500', () => {
    const response = createResponse();
    const error = new AppError('Database failed', {
      code: 'DATABASE_FAILED',
      kind: 'infrastructure',
    });

    filter.catch(error, createHost(response));

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'DATABASE_FAILED',
      message: 'Database failed',
      details: {},
    });
  });
});
