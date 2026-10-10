import {
  CalendarDate,
  DomainError,
  EAppErrorCode,
  Money,
  Result,
  ValueObject,
} from '@investflow/shared-domain';
import { InvestmentCalculationError } from '../calculations/investment-calculation.error';
import { InvestmentScenario } from '../calculations/investment-scenario.vo';
import type { IndexCurve } from '../index-curves/index-curve.aggregate';
import { InvestmentTerms } from '../offers/terms/investment-terms.vo';

export interface SimulationInputsProps {
  readonly terms: InvestmentTerms;
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
  // The market assumption for indexed remuneration; null for fixed rates.
  readonly indexCurveId: string | null;
}

export class SimulationInputs extends ValueObject<SimulationInputs> {
  private constructor(private readonly props: SimulationInputsProps) {
    super();
  }

  static create(props: SimulationInputsProps): SimulationInputs {
    return new SimulationInputs({ ...props });
  }

  get terms(): InvestmentTerms {
    return this.props.terms;
  }

  get principal(): Money {
    return this.props.principal;
  }

  get investmentDate(): CalendarDate {
    return this.props.investmentDate;
  }

  get indexCurveId(): string | null {
    return this.props.indexCurveId;
  }

  toScenario(
    indexCurve: IndexCurve | null,
  ): Result<InvestmentScenario, InvestmentCalculationError> {
    if ((indexCurve?.id ?? null) !== this.props.indexCurveId) {
      throw new DomainError('A curva não corresponde às entradas.', {
        code: EAppErrorCode.INVESTMENT_SCENARIO_INVARIANT,
        kind: 'unexpected',
        metadata: {
          expectedCurveId: this.props.indexCurveId,
          actualCurveId: indexCurve?.id ?? null,
        },
      });
    }
    return InvestmentScenario.create({
      principal: this.props.principal,
      investmentDate: this.props.investmentDate,
      maturityDate: this.props.terms.maturityDate,
      titleType: this.props.terms.titleType,
      remuneration: this.props.terms.remuneration,
      indexCurve,
    });
  }

  equals(other: SimulationInputs): boolean {
    return (
      this.terms.equals(other.terms) &&
      this.principal.equals(other.principal) &&
      this.investmentDate.equals(other.investmentDate) &&
      this.indexCurveId === other.indexCurveId
    );
  }
}
