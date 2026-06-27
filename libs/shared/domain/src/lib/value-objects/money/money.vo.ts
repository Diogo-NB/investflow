import Decimal from 'decimal.js';
import { DomainError } from '../../errors/domain.error';
import { Result } from '../../result/result';
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

  static create(
    amount: Decimal | number | string,
  ): Result<Money, InvalidMoneyError> {
    const decimal = new Decimal(amount);
    if (decimal.lessThanOrEqualTo(0)) {
      return Result.err(new InvalidMoneyError(decimal));
    }

    return Result.ok(new Money(decimal, 'BRL'));
  }

  static of(amount: Decimal | number | string): Money {
    const result = Money.create(amount);
    if (result.isErr()) throw result.error;
    return result.value;
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
