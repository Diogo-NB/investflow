import { AppError, Result } from '@investflow/shared-domain';

export interface UseCase<Input, Output, E extends AppError = AppError> {
  execute(input: Input): Promise<Result<Output, E>>;
}

export type CommandHandler<
  Command,
  Output,
  E extends AppError = AppError,
> = UseCase<Command, Output, E>;

export type QueryHandler<
  Query,
  Output,
  E extends AppError = AppError,
> = UseCase<Query, Output, E>;
