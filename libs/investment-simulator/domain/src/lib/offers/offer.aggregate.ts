import {
  AggregateRoot,
  CalendarDate,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';
import type { RedemptionTerms } from './terms/redemption/redemption-terms.vo';
import type { RemunerationTerms } from './terms/remuneration/remuneration-terms.vo';
import { ETitleType } from './title-type.enum';

interface OfferProps {
  readonly titleType: ETitleType;
  readonly issuerName: string | null;
  maturityDate: CalendarDate;
  redemptionTerms: RedemptionTerms;
  remunerationTerms: RemunerationTerms;
  deletedAt: UtcInstant | null;
}

export type CreateOfferProps = Omit<OfferProps, 'deletedAt'>;

export type ReconstituteOfferProps = OfferProps & { readonly id: string };

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
      issuerName: props.issuerName,
      maturityDate: props.maturityDate,
      redemptionTerms: props.redemptionTerms,
      remunerationTerms: props.remunerationTerms,
      deletedAt: null,
    });
  }

  static reconstitute(props: ReconstituteOfferProps): Offer {
    return new Offer(props.id, {
      titleType: props.titleType,
      issuerName: props.issuerName,
      maturityDate: props.maturityDate,
      redemptionTerms: props.redemptionTerms,
      remunerationTerms: props.remunerationTerms,
      deletedAt: props.deletedAt,
    });
  }

  get titleType(): ETitleType {
    return this.props.titleType;
  }

  get issuerName(): string | null {
    return this.props.issuerName;
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

  updateMaturityDate(maturityDate: CalendarDate): this {
    if (!this.props.maturityDate.equals(maturityDate)) {
      this.props.maturityDate = maturityDate;
    }
    return this;
  }

  updateRedemptionTerms(redemptionTerms: RedemptionTerms): this {
    if (!this.props.redemptionTerms.equals(redemptionTerms)) {
      this.props.redemptionTerms = redemptionTerms;
    }
    return this;
  }

  updateRemunerationTerms(remunerationTerms: RemunerationTerms): this {
    if (!this.props.remunerationTerms.equals(remunerationTerms)) {
      this.props.remunerationTerms = remunerationTerms;
    }
    return this;
  }

  delete(at: UtcInstant): this {
    if (!this.props.deletedAt) this.props.deletedAt = at;
    return this;
  }
}
