import { Money } from '@investflow/shared-domain';

const PT_BR_LOCALE = 'pt-BR';

type CurrencyDisplay = NonNullable<Intl.NumberFormatOptions['currencyDisplay']>;

export interface MoneyFormatOptions {
  readonly currencyDisplay?: CurrencyDisplay;
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
  readonly useGrouping?: boolean;
}

export function formatMoney(
  money: Money,
  locale: string,
  options: MoneyFormatOptions = {},
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    ...options,
  });

  return formatter.format(money.amount.toString() as Intl.StringNumericLiteral);
}

export function formatMoneyPtBr(
  money: Money,
  options: MoneyFormatOptions = {},
): string {
  return formatMoney(money, PT_BR_LOCALE, options);
}
