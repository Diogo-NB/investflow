import { Result } from '@investflow/shared-domain';

export interface CommandHandler<Command, Output> {
  execute(command: Command): Promise<Result<Output>>;
}

export interface QueryHandler<Query, Output> {
  execute(query: Query): Promise<Result<Output>>;
}
