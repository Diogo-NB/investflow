export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findByIdOrThrow(id: string): Promise<T>;
  save(aggregate: T): Promise<void>;
}
