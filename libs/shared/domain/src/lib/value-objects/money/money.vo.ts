import Decimal from 'decimal.js';
import { DomainError } from '../../errors/domain.error';
import { Result } from '../../result/result';
import { ValueObject } from '../value-object.base';

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const DEFAULT_CURRENCY = 'BRL';

export interface SerializedMoney {
  readonly amount: string;
  readonly currency: string;
}

export class InvalidMoneyError extends DomainError {
  constructor(reason: string, input?: unknown) {
    super(`Invalid money: ${reason}`, {
      code: 'INVALID_MONEY',
      metadata: input === undefined ? { reason } : { reason, input },
    });
  }
}

export class MoneyCurrencyMismatchError extends DomainError {
  constructor(leftCurrency: string, rightCurrency: string) {
    super(
      `Cannot operate on money with different currencies: ${leftCurrency} and ${rightCurrency}`,
      {
        code: 'MONEY_CURRENCY_MISMATCH',
        metadata: { leftCurrency, rightCurrency },
      },
    );
  }
}

export class Money extends ValueObject<Money> {
  private constructor(
    private readonly amountValue: Decimal,
    readonly currency: string,
  ) {
    super();
  }

  static create(
    amount: Decimal | number | string,
    currency = DEFAULT_CURRENCY,
  ): Result<Money, InvalidMoneyError> {
    if (!CURRENCY_CODE_PATTERN.test(currency)) {
      return Result.err(
        new InvalidMoneyError(
          'currency must use a three-letter uppercase code',
          currency,
        ),
      );
    }

    let decimal: Decimal;
    try {
      decimal = new Decimal(amount);
    } catch {
      return Result.err(
        new InvalidMoneyError(
          'amount must be a valid decimal value',
          serializeInvalidAmount(amount),
        ),
      );
    }

    if (!decimal.isFinite()) {
      return Result.err(
        new InvalidMoneyError(
          'amount must be finite',
          serializeInvalidAmount(amount),
        ),
      );
    }

    return Result.ok(new Money(decimal, currency));
  }

  static of(
    amount: Decimal | number | string,
    currency = DEFAULT_CURRENCY,
  ): Money {
    const result = Money.create(amount, currency);
    if (result.isErr()) throw result.error;
    return result.value;
  }

  static zero(currency = DEFAULT_CURRENCY): Money {
    return Money.of(0, currency);
  }

  get amount(): Decimal {
    return new Decimal(this.amountValue);
  }

  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.of(this.amountValue.plus(other.amountValue), this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.of(this.amountValue.minus(other.amountValue), this.currency);
  }

  isZero(): boolean {
    return this.amountValue.isZero();
  }

  isPositive(): boolean {
    return this.amountValue.isPositive() && !this.amountValue.isZero();
  }

  isNegative(): boolean {
    return this.amountValue.isNegative() && !this.amountValue.isZero();
  }

  greaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.amountValue.greaterThan(other.amountValue);
  }

  greaterThanOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.amountValue.greaterThanOrEqualTo(other.amountValue);
  }

  lessThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.amountValue.lessThan(other.amountValue);
  }

  lessThanOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.amountValue.lessThanOrEqualTo(other.amountValue);
  }

  override toString(): string {
    return `${this.amountValue.toString()} ${this.currency}`;
  }

  toJSON(): SerializedMoney {
    return {
      amount: this.amountValue.toString(),
      currency: this.currency,
    };
  }

  equals(other: Money): boolean {
    return (
      this.amountValue.equals(other.amountValue) &&
      this.currency === other.currency
    );
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyCurrencyMismatchError(this.currency, other.currency);
    }
  }
}

function serializeInvalidAmount(amount: unknown): string {
  try {
    return String(amount);
  } catch {
    return '<unprintable>';
  }
}
