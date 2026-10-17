import {
  CalendarDate,
  DomainError,
  EAppErrorCode,
  ValueObject,
} from '@investflow/shared-domain';

// Capitalization and annualized returns both count 252 business days a year.
export const BUSINESS_DAYS_PER_YEAR = 252;

export interface InvestmentTermProps {
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
  // Business days from the investment date (excluded) to maturity (included),
  // one per accrual period.
  readonly businessDays: number;
}

// The period an investment is held, in the two counts the rules use: business
// days for interest and returns, calendar days for taxes.
export class InvestmentTerm extends ValueObject<InvestmentTerm> {
  private constructor(private readonly props: InvestmentTermProps) {
    super();
  }

  static of(props: InvestmentTermProps): InvestmentTerm {
    const { investmentDate, maturityDate, businessDays } = props;
    if (
      !investmentDate.isBefore(maturityDate) ||
      !Number.isInteger(businessDays) ||
      businessDays < 1 ||
      businessDays > investmentDate.daysUntil(maturityDate)
    ) {
      throw new DomainError('O prazo do investimento é inconsistente.', {
        code: EAppErrorCode.INVESTMENT_SCENARIO_INVARIANT,
        kind: 'unexpected',
        metadata: {
          investmentDate: investmentDate.toIsoString(),
          maturityDate: maturityDate.toIsoString(),
          businessDays,
        },
      });
    }
    return new InvestmentTerm({ ...props });
  }

  get investmentDate(): CalendarDate {
    return this.props.investmentDate;
  }

  get maturityDate(): CalendarDate {
    return this.props.maturityDate;
  }

  get businessDays(): number {
    return this.props.businessDays;
  }

  // The holding period for IOF and income tax: the investment date is not
  // counted and maturity is.
  get calendarDays(): number {
    return this.investmentDate.daysUntil(this.maturityDate);
  }

  equals(other: InvestmentTerm): boolean {
    return (
      this.investmentDate.equals(other.investmentDate) &&
      this.maturityDate.equals(other.maturityDate) &&
      this.businessDays === other.businessDays
    );
  }
}
