export abstract class ValueObject<T extends ValueObject<T>> {
  abstract equals(other: T): boolean;
}
