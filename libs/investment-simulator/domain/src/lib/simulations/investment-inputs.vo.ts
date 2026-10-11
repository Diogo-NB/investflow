import { CalendarDate, Money, ValueObject } from '@investflow/shared-domain';

export interface InvestmentInputsProps {
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
  // The market assumption for indexed remuneration; null for fixed rates.
  readonly curveId: string | null;
}

export class InvestmentInputs extends ValueObject<InvestmentInputs> {
  private constructor(private readonly props: InvestmentInputsProps) {
    super();
  }

  static create(props: InvestmentInputsProps): InvestmentInputs {
    return new InvestmentInputs({ ...props });
  }

  get principal(): Money {
    return this.props.principal;
  }

  get investmentDate(): CalendarDate {
    return this.props.investmentDate;
  }

  get curveId(): string | null {
    return this.props.curveId;
  }

  equals(other: InvestmentInputs): boolean {
    return (
      this.principal.equals(other.principal) &&
      this.investmentDate.equals(other.investmentDate) &&
      this.curveId === other.curveId
    );
  }
}
