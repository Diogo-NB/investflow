import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AppError } from '@investflow/shared-domain';

// Server-side failures can describe internals; the log keeps the original.
const SERVER_FAILURE_MESSAGE =
  'Não foi possível concluir agora. Tente novamente.';

@Catch(AppError)
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: AppError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const status = this.resolveStatus(exception);

    this.logger.warn(
      `${exception.name} ${exception.code}: ${exception.message}`,
    );

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message:
        status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? SERVER_FAILURE_MESSAGE
          : exception.message,
      details: exception.metadata ?? {},
    });
  }

  private resolveStatus(exception: AppError): number {
    switch (exception.kind) {
      case 'not-found':
        return HttpStatus.NOT_FOUND;
      case 'conflict':
        return HttpStatus.CONFLICT;
      case 'unauthorized':
        return HttpStatus.UNAUTHORIZED;
      case 'forbidden':
        return HttpStatus.FORBIDDEN;
      case 'external':
      case 'infrastructure':
      case 'unexpected':
        return HttpStatus.INTERNAL_SERVER_ERROR;
      case 'validation':
        return HttpStatus.UNPROCESSABLE_ENTITY;
    }
  }
}
