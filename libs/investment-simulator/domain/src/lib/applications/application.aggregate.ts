import {
  AggregateRoot,
  CalendarDate,
  generateUuid,
  Money,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import type { Offer } from '../offers/offer.aggregate';
import {
  ApplicationDeletedError,
  InvalidApplicationError,
} from './application.error';

interface ApplicationProps {
  readonly ownerId: string;
  offerSnapshotId: string;
  principal: Money;
  investmentDate: CalendarDate;
  deletedAt: UtcInstant | null;
}

export interface ReviseApplicationProps {
  readonly offerSnapshot: Offer;
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
      this.props.principal = props.principal;
      this.props.investmentDate = props.investmentDate;
    });
  }

  delete(at: UtcInstant): this {
    if (!this.props.deletedAt) this.props.deletedAt = at;
    return this;
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
    if (!props.investmentDate.isBefore(props.offerSnapshot.maturityDate)) {
      return Result.err(
        new InvalidApplicationError('investment date must precede maturity', {
          investmentDate: props.investmentDate.toIsoString(),
          maturityDate: props.offerSnapshot.maturityDate.toIsoString(),
        }),
      );
    }
    return Result.ok(undefined);
  }
}
