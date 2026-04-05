import Decimal from 'decimal.js';
import { DomainError } from '../../errors/domain.error';
import { ValueObject } from '../value-object.base';

export class InvalidMoneyError extends DomainError {
  constructor(amount: Decimal) {
    super(`Money amount must be greater than zero, got: ${amount.toString()}`);
  }
}

export class Money extends ValueObject<Money> {
  private constructor(
    readonly amount: Decimal,
    readonly currency: 'BRL',
  ) {
    super();
  }

  static of(amount: Decimal | number | string): Money {
    const decimal = new Decimal(amount);
    if (decimal.lessThanOrEqualTo(0)) throw new InvalidMoneyError(decimal);
    return new Money(decimal, 'BRL');
  }

  add(other: Money): Money {
    return Money.of(this.amount.plus(other.amount));
  }

  subtract(other: Money): Money {
    return Money.of(this.amount.minus(other.amount));
  }

  greaterThan(other: Money): boolean {
    return this.amount.greaterThan(other.amount);
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.amount.greaterThanOrEqualTo(other.amount);
  }

  lessThan(other: Money): boolean {
    return this.amount.lessThan(other.amount);
  }

  equals(other: Money): boolean {
    return this.amount.equals(other.amount) && this.currency === other.currency;
  }
}
