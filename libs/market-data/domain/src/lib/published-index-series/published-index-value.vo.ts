import { CalendarDate, ValueObject } from '@investflow/shared-domain';
import Decimal from 'decimal.js';

export class PublishedIndexValue extends ValueObject<PublishedIndexValue> {
  private constructor(
    readonly referenceDate: CalendarDate,
    readonly value: Decimal,
  ) {
    super();
  }

  static of(referenceDate: CalendarDate, value: Decimal): PublishedIndexValue {
    return new PublishedIndexValue(referenceDate, value);
  }

  equals(other: PublishedIndexValue): boolean {
    return (
      this.referenceDate.equals(other.referenceDate) &&
      this.value.equals(other.value)
    );
  }
}
