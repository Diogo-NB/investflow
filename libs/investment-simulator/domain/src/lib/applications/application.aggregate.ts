import {
  AggregateRoot,
  CalendarDate,
  DomainError,
  generateUuid,
  Money,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { InvestmentCalculationError } from '../calculations/investment-calculation.error';
import { InvestmentScenario } from '../calculations/investment-scenario.vo';
import type { IndexCurve } from '../index-curves/index-curve.aggregate';
import type { Offer } from '../offers/offer.aggregate';
import {
  ApplicationDeletedError,
  InvalidApplicationError,
} from './application.error';

interface ApplicationProps {
  readonly ownerId: string;
  offerSnapshotId: string;
  indexCurveId: string | null;
  principal: Money;
  investmentDate: CalendarDate;
  deletedAt: UtcInstant | null;
}

export interface ReviseApplicationProps {
  readonly offerSnapshot: Offer;
  // The market assumption for indexed remuneration; null for fixed rates.
  readonly indexCurve: IndexCurve | null;
  readonly principal: Money;
  readonly investmentDate: CalendarDate;
}

export interface CreateApplicationProps extends ReviseApplicationProps {
  readonly ownerId: string;
}

export type ReconstituteApplicationProps = ApplicationProps & {
  readonly id: string;
};

export class Application extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: ApplicationProps,
  ) {
    super(id);
  }

  static create(
    props: CreateApplicationProps,
  ): Result<Application, InvalidApplicationError> {
    return Application.validateInvestment(props).map(
      () =>
        new Application(generateUuid(), {
          ownerId: props.ownerId,
          offerSnapshotId: props.offerSnapshot.id,
          indexCurveId: props.indexCurve?.id ?? null,
          principal: props.principal,
          investmentDate: props.investmentDate,
          deletedAt: null,
        }),
    );
  }

  static reconstitute(props: ReconstituteApplicationProps): Application {
    return new Application(props.id, {
      ownerId: props.ownerId,
      offerSnapshotId: props.offerSnapshotId,
      indexCurveId: props.indexCurveId,
      principal: props.principal,
      investmentDate: props.investmentDate,
      deletedAt: props.deletedAt,
    });
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get offerSnapshotId(): string {
    return this.props.offerSnapshotId;
  }

  get indexCurveId(): string | null {
    return this.props.indexCurveId;
  }

  get principal(): Money {
    return this.props.principal;
  }

  get investmentDate(): CalendarDate {
    return this.props.investmentDate;
  }

  get deletedAt(): UtcInstant | null {
    return this.props.deletedAt;
  }

  revise(
    props: ReviseApplicationProps,
  ): Result<void, InvalidApplicationError | ApplicationDeletedError> {
    if (this.props.deletedAt) {
      return Result.err(new ApplicationDeletedError(this.id));
    }

    return Application.validateInvestment(props).map(() => {
      this.props.offerSnapshotId = props.offerSnapshot.id;
      this.props.indexCurveId = props.indexCurve?.id ?? null;
      this.props.principal = props.principal;
      this.props.investmentDate = props.investmentDate;
    });
  }

  delete(at: UtcInstant): this {
    if (!this.props.deletedAt) this.props.deletedAt = at;
    return this;
  }

  // Builds the calculable scenario from this application's own references.
  toScenario(
    offerSnapshot: Offer,
    indexCurve: IndexCurve | null,
  ): Result<InvestmentScenario, DomainError> {
    if (this.props.deletedAt) {
      return Result.err(new ApplicationDeletedError(this.id));
    }
    if (
      offerSnapshot.id !== this.props.offerSnapshotId ||
      (indexCurve?.id ?? null) !== this.props.indexCurveId
    ) {
      return Result.err(
        new InvalidApplicationError('scenario references do not match', {
          applicationId: this.id,
          offerSnapshotId: offerSnapshot.id,
          indexCurveId: indexCurve?.id ?? null,
        }),
      );
    }
    return Application.scenarioOf({ ...this.props, offerSnapshot, indexCurve });
  }

  private static validateInvestment(
    props: ReviseApplicationProps,
  ): Result<void, InvalidApplicationError> {
    if (!props.offerSnapshot.isSnapshot || props.offerSnapshot.deletedAt) {
      return Result.err(
        new InvalidApplicationError('offer must be an available snapshot', {
          offerId: props.offerSnapshot.id,
        }),
      );
    }
    if (!props.principal.isPositive()) {
      return Result.err(
        new InvalidApplicationError('principal must be greater than zero'),
      );
    }
    if (props.principal.currency !== 'BRL') {
      return Result.err(new InvalidApplicationError('principal must use BRL'));
    }
    // A saved hypothesis must describe a calculable scenario, apart from
    // calendar rules that only the calculation enforces.
    return Application.scenarioOf(props)
      .map(() => undefined)
      .mapError(
        (error) =>
          new InvalidApplicationError(error.message, {
            ...error.metadata,
            scenarioCode: error.code,
          }),
      );
  }

  private static scenarioOf(
    props: ReviseApplicationProps,
  ): Result<InvestmentScenario, InvestmentCalculationError> {
    return InvestmentScenario.create({
      principal: props.principal,
      investmentDate: props.investmentDate,
      maturityDate: props.offerSnapshot.maturityDate,
      titleType: props.offerSnapshot.titleType,
      remuneration: props.offerSnapshot.remunerationTerms,
      indexCurve: props.indexCurve,
    });
  }
}
