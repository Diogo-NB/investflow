import {
  AggregateRoot,
  CalendarDate,
  generateUuid,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { OfferDeletedError } from './offer-deleted.error';
import type { RedemptionTerms } from './terms/redemption/redemption-terms.vo';
import type { RemunerationTerms } from './terms/remuneration/remuneration-terms.vo';
import { TitleType } from './title-type.enum';

interface OfferProps {
  readonly titleType: TitleType;
  readonly issuerId: string;
  maturityDate: CalendarDate;
  redemptionTerms: RedemptionTerms;
  remunerationTerms: RemunerationTerms;
  deletedAt: UtcInstant | null;
}

export type CreateOfferProps = Omit<OfferProps, 'deletedAt'>;

export type ReconstituteOfferProps = OfferProps & {
  readonly id: string;
};

export class Offer extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: OfferProps,
  ) {
    super(id);
  }

  static create(props: CreateOfferProps): Offer {
    return new Offer(generateUuid(), {
      titleType: props.titleType,
      issuerId: props.issuerId,
      maturityDate: props.maturityDate,
      redemptionTerms: props.redemptionTerms,
      remunerationTerms: props.remunerationTerms,
      deletedAt: null,
    });
  }

  static reconstitute(props: ReconstituteOfferProps): Offer {
    return new Offer(props.id, {
      titleType: props.titleType,
      issuerId: props.issuerId,
      maturityDate: props.maturityDate,
      redemptionTerms: props.redemptionTerms,
      remunerationTerms: props.remunerationTerms,
      deletedAt: props.deletedAt,
    });
  }

  get titleType(): TitleType {
    return this.props.titleType;
  }

  get issuerId(): string {
    return this.props.issuerId;
  }

  get maturityDate(): CalendarDate {
    return this.props.maturityDate;
  }

  get redemptionTerms(): RedemptionTerms {
    return this.props.redemptionTerms;
  }

  get remunerationTerms(): RemunerationTerms {
    return this.props.remunerationTerms;
  }

  get deletedAt(): UtcInstant | null {
    return this.props.deletedAt;
  }

  updateMaturityDate(
    maturityDate: CalendarDate,
  ): Result<this, OfferDeletedError> {
    const active = this.ensureActive();
    if (active.isErr()) return active;
    if (!this.props.maturityDate.equals(maturityDate)) {
      this.props.maturityDate = maturityDate;
    }
    return Result.ok(this);
  }

  updateRedemptionTerms(
    redemptionTerms: RedemptionTerms,
  ): Result<this, OfferDeletedError> {
    const active = this.ensureActive();
    if (active.isErr()) return active;
    if (!this.props.redemptionTerms.equals(redemptionTerms)) {
      this.props.redemptionTerms = redemptionTerms;
    }
    return Result.ok(this);
  }

  updateRemunerationTerms(
    remunerationTerms: RemunerationTerms,
  ): Result<this, OfferDeletedError> {
    const active = this.ensureActive();
    if (active.isErr()) return active;
    if (!this.props.remunerationTerms.equals(remunerationTerms)) {
      this.props.remunerationTerms = remunerationTerms;
    }
    return Result.ok(this);
  }

  softDelete(at: UtcInstant): this {
    if (this.props.deletedAt === null) this.props.deletedAt = at;
    return this;
  }

  private ensureActive(): Result<this, OfferDeletedError> {
    return this.props.deletedAt === null
      ? Result.ok(this)
      : Result.err(new OfferDeletedError(this.id));
  }
}
