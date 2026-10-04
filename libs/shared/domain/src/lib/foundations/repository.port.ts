import { AppError } from './app.error';
import { Result } from './result';

export abstract class Repository<T, E extends AppError = AppError> {
  abstract findById(id: string): Promise<Result<T, E>>;
  abstract save(aggregate: T): Promise<Result<void, E>>;
}
