import {
  AggregateRoot,
  CalendarDate,
  generateUuid,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import type { RedemptionTerms } from './terms/redemption/redemption-terms.vo';
import type { RemunerationTerms } from './terms/remuneration/remuneration-terms.vo';
import { TitleType } from './title-type.enum';
import {
  ImmutableOfferSnapshotError,
  InvalidOfferSnapshotError,
} from './offer.error';

interface OfferProps {
  readonly titleType: TitleType;
  readonly issuerId: string;
  readonly sourceOfferId: string | null;
  maturityDate: CalendarDate;
  redemptionTerms: RedemptionTerms;
  remunerationTerms: RemunerationTerms;
  deletedAt: UtcInstant | null;
}

export type CreateOfferProps = Omit<OfferProps, 'deletedAt' | 'sourceOfferId'>;

export type OfferSnapshotOverrides = Partial<
  Pick<OfferProps, 'maturityDate' | 'redemptionTerms' | 'remunerationTerms'>
>;

export type ReconstituteOfferProps = Omit<OfferProps, 'sourceOfferId'> & {
  readonly id: string;
  readonly sourceOfferId?: string | null;
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
      sourceOfferId: null,
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
      sourceOfferId: props.sourceOfferId ?? null,
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

  get sourceOfferId(): string | null {
    return this.props.sourceOfferId;
  }

  get isSnapshot(): boolean {
    return this.props.sourceOfferId !== null;
  }

  createSnapshot(
    overrides: OfferSnapshotOverrides = {},
  ): Result<Offer, InvalidOfferSnapshotError> {
    if (this.props.deletedAt) {
      return Result.err(new InvalidOfferSnapshotError(this.id));
    }

    return Result.ok(
      new Offer(generateUuid(), {
        titleType: this.props.titleType,
        issuerId: this.props.issuerId,
        sourceOfferId: this.props.sourceOfferId ?? this.id,
        maturityDate: overrides.maturityDate ?? this.props.maturityDate,
        redemptionTerms:
          overrides.redemptionTerms ?? this.props.redemptionTerms,
        remunerationTerms:
          overrides.remunerationTerms ?? this.props.remunerationTerms,
        deletedAt: null,
      }),
    );
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

  updateMaturityDate(maturityDate: CalendarDate): this {
    this.ensureMutable();
    if (!this.props.maturityDate.equals(maturityDate)) {
      this.props.maturityDate = maturityDate;
    }
    return this;
  }

  updateRedemptionTerms(redemptionTerms: RedemptionTerms): this {
    this.ensureMutable();
    if (!this.props.redemptionTerms.equals(redemptionTerms)) {
      this.props.redemptionTerms = redemptionTerms;
    }
    return this;
  }

  updateRemunerationTerms(remunerationTerms: RemunerationTerms): this {
    this.ensureMutable();
    if (!this.props.remunerationTerms.equals(remunerationTerms)) {
      this.props.remunerationTerms = remunerationTerms;
    }
    return this;
  }

  delete(at: UtcInstant): this {
    this.ensureMutable();
    if (!this.props.deletedAt) this.props.deletedAt = at;
    return this;
  }

  private ensureMutable(): void {
    if (this.isSnapshot) throw new ImmutableOfferSnapshotError(this.id);
  }
}
