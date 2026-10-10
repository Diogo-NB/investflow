import {
  CalendarDate,
  DomainError,
  EAppErrorCode,
  Money,
  Result,
  ValueObject,
} from '@investflow/shared-domain';
import { IndexCurve } from '../index-curves/index-curve.aggregate';
import { RemunerationTerms } from '../offers/terms/remuneration/remuneration-terms.vo';
import { ETitleType } from '../offers/title-type.enum';
import { InvestmentCalculationError } from './investment-calculation.error';

export interface InvestmentScenarioProps {
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
  readonly titleType: ETitleType;
  readonly remuneration: RemunerationTerms;
  readonly indexCurve: IndexCurve | null;
}

// Everything one calculation depends on, independent of how it is persisted.
export class InvestmentScenario extends ValueObject<InvestmentScenario> {
  private constructor(private readonly props: InvestmentScenarioProps) {
    super();
  }

  static create(
    props: InvestmentScenarioProps,
  ): Result<InvestmentScenario, InvestmentCalculationError> {
    if (!props.principal.isPositive()) {
      return Result.err(
        new InvestmentCalculationError(
          EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID,
          'O valor aplicado deve ser maior que zero.',
        ),
      );
    }
    if (props.principal.currency !== 'BRL') {
      return Result.err(
        new InvestmentCalculationError(
          EAppErrorCode.INVESTMENT_PRINCIPAL_INVALID,
          'O valor aplicado deve estar em reais (BRL).',
          { currency: props.principal.currency },
        ),
      );
    }
    if (!props.investmentDate.isBefore(props.maturityDate)) {
      return Result.err(
        new InvestmentCalculationError(
          EAppErrorCode.INVESTMENT_PERIOD_INVALID,
          'O vencimento deve ser depois da data da aplicação.',
          {
            investmentDate: props.investmentDate.toIsoString(),
            maturityDate: props.maturityDate.toIsoString(),
          },
        ),
      );
    }
    const curveError = InvestmentScenario.checkCurve(props);
    if (curveError) return Result.err(curveError);
    return Result.ok(new InvestmentScenario(props));
  }

  get principal(): Money {
    return this.props.principal;
  }

  get investmentDate(): CalendarDate {
    return this.props.investmentDate;
  }

  get maturityDate(): CalendarDate {
    return this.props.maturityDate;
  }

  get titleType(): ETitleType {
    return this.props.titleType;
  }

  get remuneration(): RemunerationTerms {
    return this.props.remuneration;
  }

  get indexCurve(): IndexCurve | null {
    return this.props.indexCurve;
  }

  // Calendar days counted from the day after investment through maturity.
  get holdingPeriodCalendarDays(): number {
    return this.props.investmentDate.daysUntil(this.props.maturityDate);
  }

  // For indexed remunerations, which create() guarantees have a curve.
  requireIndexCurve(): IndexCurve {
    const curve = this.props.indexCurve;
    if (!curve) {
      throw new DomainError('A remuneração indexada está sem curva.', {
        code: EAppErrorCode.INVESTMENT_SCENARIO_INVARIANT,
        kind: 'unexpected',
      });
    }
    return curve;
  }

  equals(other: InvestmentScenario): boolean {
    return (
      this.principal.equals(other.principal) &&
      this.investmentDate.equals(other.investmentDate) &&
      this.maturityDate.equals(other.maturityDate) &&
      this.titleType === other.titleType &&
      this.remuneration.equals(other.remuneration) &&
      this.indexCurve?.id === other.indexCurve?.id
    );
  }

  private static checkCurve(
    props: InvestmentScenarioProps,
  ): InvestmentCalculationError | null {
    const requiredIndex = props.remuneration.requiredIndex;
    const curve = props.indexCurve;
    if (requiredIndex && !curve) {
      return new InvestmentCalculationError(
        EAppErrorCode.INVESTMENT_CURVE_REQUIRED,
        'Escolha a curva do índice.',
        { index: requiredIndex },
      );
    }
    if (!curve) return null;
    if (curve.index !== requiredIndex) {
      return new InvestmentCalculationError(
        EAppErrorCode.INVESTMENT_CURVE_INCOMPATIBLE,
        'A curva escolhida não é do índice desta remuneração.',
        {
          curveId: curve.id,
          expectedIndex: requiredIndex,
          actualIndex: curve.index,
        },
      );
    }
    if (curve.deletedAt) {
      return new InvestmentCalculationError(
        EAppErrorCode.INVESTMENT_CURVE_UNAVAILABLE,
        'Esta curva foi excluída. Escolha outra curva.',
        { curveId: curve.id },
      );
    }
    return null;
  }
}
