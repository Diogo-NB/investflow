import {
  CalendarDate,
  DomainError,
  EAppErrorCode,
  Money,
  ValueObject,
} from '@investflow/shared-domain';
import type { TaxAssessment } from '../taxes/tax-assessment.type';
import { InvestmentTerm } from './investment-term.vo';
import { MaturityOutcome } from './maturity-outcome.vo';

export interface DailyInvestmentBalance {
  readonly date: CalendarDate;
  readonly grossBalance: Money;
  readonly dailyGrossEarnings: Money;
  readonly accumulatedGrossEarnings: Money;
}

export interface InvestmentProjectionProps {
  readonly principal: Money;
  readonly term: InvestmentTerm;
  // One gross balance per business day of the term; taxes are due only at
  // maturity, so no daily balance is net.
  readonly dailyBalances: readonly DailyInvestmentBalance[];
  readonly taxes: TaxAssessment;
}

// An investment projected to maturity, held to the end. Everything else is
// derived from the principal, the daily gross balances and the taxes, so the
// gross and net outcomes cannot disagree with them.
export class InvestmentProjection extends ValueObject<InvestmentProjection> {
  // Before taxes: the last daily balance.
  readonly gross: MaturityOutcome;
  // After IOF and income tax.
  readonly net: MaturityOutcome;

  private constructor(private readonly props: InvestmentProjectionProps) {
    super();
    const { principal, term, dailyBalances, taxes } = props;
    this.gross = MaturityOutcome.of(
      principal,
      dailyBalances[dailyBalances.length - 1].grossBalance,
      term,
    );
    this.net = MaturityOutcome.of(
      principal,
      this.gross.finalBalance.subtract(taxes.total),
      term,
    );
  }

  static create(props: InvestmentProjectionProps): InvestmentProjection {
    const { term, dailyBalances } = props;
    if (
      dailyBalances.length !== term.businessDays ||
      !dailyBalances[dailyBalances.length - 1].date.equals(term.maturityDate)
    ) {
      throw new DomainError(
        'Os saldos diários não correspondem ao prazo do investimento.',
        {
          code: EAppErrorCode.INVESTMENT_SCENARIO_INVARIANT,
          kind: 'unexpected',
          metadata: {
            businessDays: term.businessDays,
            dailyBalances: dailyBalances.length,
          },
        },
      );
    }
    return new InvestmentProjection({
      ...props,
      dailyBalances: [...dailyBalances],
    });
  }

  get principal(): Money {
    return this.props.principal;
  }

  get term(): InvestmentTerm {
    return this.props.term;
  }

  get dailyBalances(): readonly DailyInvestmentBalance[] {
    return this.props.dailyBalances;
  }

  get taxes(): TaxAssessment {
    return this.props.taxes;
  }

  equals(other: InvestmentProjection): boolean {
    return (
      this.term.equals(other.term) &&
      this.gross.equals(other.gross) &&
      this.net.equals(other.net)
    );
  }
}
