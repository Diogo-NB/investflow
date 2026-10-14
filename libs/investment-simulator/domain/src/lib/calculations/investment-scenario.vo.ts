import {
  CalendarDate,
  DomainError,
  EAppErrorCode,
  Money,
  Result,
  ValueObject,
} from '@investflow/shared-domain';
import { Curve } from '../curves/curve.aggregate';
import { RemunerationTerms } from '../offers/terms/remuneration/remuneration-terms.vo';
import { TITLE_TYPE_RULES } from '../offers/title-type-rules';
import { ETitleType } from '../offers/title-type.enum';
import { InvestmentCalculationError } from './investment-calculation.error';

export interface InvestmentScenarioProps {
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
  readonly maturityDate: CalendarDate;
  readonly titleType: ETitleType;
  readonly remuneration: RemunerationTerms;
  readonly curve: Curve | null;
}

// Everything one calculation depends on, independent of how it is persisted.
export class InvestmentScenario extends ValueObject<InvestmentScenario> {
  private constructor(private readonly props: InvestmentScenarioProps) {
    super();
  }

  static create(
    props: InvestmentScenarioProps,
  ): Result<InvestmentScenario, InvestmentCalculationError> {
    if (!props.principal.isPositive) {
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
    const termError = InvestmentScenario.checkMinimumTerm(props);
    if (termError) return Result.err(termError);
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

  get curve(): Curve | null {
    return this.props.curve;
  }

  // Calendar days counted from the day after investment through maturity.
  get holdingPeriodCalendarDays(): number {
    return this.props.investmentDate.daysUntil(this.props.maturityDate);
  }

  // For indexed remunerations, which create() guarantees have a curve.
  requireCurve(): Curve {
    const curve = this.props.curve;
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
      this.curve?.id === other.curve?.id
    );
  }

  private static checkMinimumTerm({
    titleType,
    investmentDate,
    maturityDate,
  }: InvestmentScenarioProps): InvestmentCalculationError | null {
    const months = TITLE_TYPE_RULES[titleType].minimumTermMonths;
    if (months === null) return null;
    const minimumMaturityDate = investmentDate.addMonths(months);
    if (!maturityDate.isBefore(minimumMaturityDate)) return null;
    return new InvestmentCalculationError(
      EAppErrorCode.INVESTMENT_TERM_TOO_SHORT,
      `${titleType} exige vencimento de ao menos ${months} meses após a aplicação (a partir de ${minimumMaturityDate.toPtBrString()}).`,
      { titleType, minimumMaturityDate: minimumMaturityDate.toIsoString() },
    );
  }

  private static checkCurve(
    props: InvestmentScenarioProps,
  ): InvestmentCalculationError | null {
    const requiredIndex = props.remuneration.requiredIndex;
    const curve = props.curve;
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
        'Sem curva, escolha outra.',
        { curveId: curve.id },
      );
    }
    return null;
  }
}
