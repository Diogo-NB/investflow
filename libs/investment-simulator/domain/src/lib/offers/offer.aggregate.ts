import {
  AggregateRoot,
  CalendarDate,
  generateUuid,
  Result,
  UtcInstant,
} from '@investflow/shared-domain';
import { InvalidOfferError, OfferRevisionConflictError } from './offer.error';
import { OfferChanged, OfferCreated, OfferDeleted } from './offer.events';
import type { RedemptionTerms } from './terms/redemption/redemption-terms.vo';
import type { RemunerationTerms } from './terms/remuneration/remuneration-terms.vo';
import { ETitleType } from './title-type.enum';

export interface OfferContent {
  readonly name: string;
  readonly issuerName: string | null;
  readonly maturityDate: CalendarDate;
  readonly redemptionTerms: RedemptionTerms;
  readonly remunerationTerms: RemunerationTerms;
}

interface OfferProps extends OfferContent {
  // Never changes; it fixes the methodology and taxation.
  readonly titleType: ETitleType;
  readonly ownerId: string | null;
  readonly revision: number;
  readonly deletedAt: UtcInstant | null;
}

export type CreateOfferProps = Pick<
  OfferProps,
  | 'titleType'
  | 'ownerId'
  | 'name'
  | 'maturityDate'
  | 'redemptionTerms'
  | 'remunerationTerms'
> & { readonly issuerName?: string | null };

export type ReconstituteOfferProps = OfferProps & { readonly id: string };

export type OfferEdit = Partial<OfferContent>;

export class Offer extends AggregateRoot {
  private constructor(
    id: string,
    private props: OfferProps,
  ) {
    super(id);
  }

  static create(
    props: CreateOfferProps,
    occurredAt: UtcInstant,
  ): Result<Offer, InvalidOfferError> {
    const content = Offer.normalize({
      name: props.name,
      issuerName: props.issuerName ?? null,
      maturityDate: props.maturityDate,
      redemptionTerms: props.redemptionTerms,
      remunerationTerms: props.remunerationTerms,
    });
    const invalid = Offer.validate(content);
    if (invalid) return Result.err(invalid);

    const offer = new Offer(generateUuid(), {
      ...content,
      titleType: props.titleType,
      ownerId: props.ownerId,
      revision: 1,
      deletedAt: null,
    });
    return Result.ok(offer.apply(new OfferCreated(offer.id, occurredAt)));
  }

  static reconstitute(props: ReconstituteOfferProps): Offer {
    const { id, ...state } = props;
    return new Offer(id, state);
  }

  get titleType(): ETitleType {
    return this.props.titleType;
  }

  get ownerId(): string | null {
    return this.props.ownerId;
  }

  get name(): string {
    return this.props.name;
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

  get revision(): number {
    return this.props.revision;
  }

  get deletedAt(): UtcInstant | null {
    return this.props.deletedAt;
  }

  isVisibleTo(actorId: string | null): boolean {
    return this.props.ownerId === null || this.props.ownerId === actorId;
  }

  canBeChangedBy(actorId: string | null): boolean {
    return this.props.ownerId === actorId;
  }

  assertRevision(expected: number): Result<this, OfferRevisionConflictError> {
    return expected === this.props.revision
      ? Result.ok(this)
      : Result.err(new OfferRevisionConflictError(this.id, expected));
  }

  // A private copy for the actor, including of a system offer.
  duplicateFor(
    ownerId: string | null,
    occurredAt: UtcInstant,
  ): Result<Offer, InvalidOfferError> {
    return Offer.create(
      {
        titleType: this.props.titleType,
        ownerId,
        name: `${this.props.name} (cópia)`,
        issuerName: this.props.issuerName,
        maturityDate: this.props.maturityDate,
        redemptionTerms: this.props.redemptionTerms,
        remunerationTerms: this.props.remunerationTerms,
      },
      occurredAt,
    );
  }

  edit(
    edit: OfferEdit,
    occurredAt: UtcInstant,
  ): Result<this, InvalidOfferError> {
    const content = Offer.normalize({
      name: edit.name ?? this.props.name,
      issuerName:
        edit.issuerName === undefined ? this.props.issuerName : edit.issuerName,
      maturityDate: edit.maturityDate ?? this.props.maturityDate,
      redemptionTerms: edit.redemptionTerms ?? this.props.redemptionTerms,
      remunerationTerms: edit.remunerationTerms ?? this.props.remunerationTerms,
    });
    const invalid = Offer.validate(content);
    if (invalid) return Result.err(invalid);

    if (this.isUnchanged(content)) return Result.ok(this);

    this.props = {
      ...this.props,
      ...content,
      revision: this.props.revision + 1,
    };
    return Result.ok(this.apply(new OfferChanged(this.id, occurredAt)));
  }

  delete(at: UtcInstant): this {
    if (this.props.deletedAt) return this;
    this.props = {
      ...this.props,
      deletedAt: at,
      revision: this.props.revision + 1,
    };
    return this.apply(new OfferDeleted(this.id, at));
  }

  private isUnchanged(content: OfferContent): boolean {
    return (
      content.name === this.props.name &&
      content.issuerName === this.props.issuerName &&
      content.maturityDate.equals(this.props.maturityDate) &&
      content.redemptionTerms.equals(this.props.redemptionTerms) &&
      content.remunerationTerms.equals(this.props.remunerationTerms)
    );
  }

  private static normalize(content: OfferContent): OfferContent {
    return {
      ...content,
      name: content.name.trim(),
      issuerName: content.issuerName?.trim() || null,
    };
  }

  private static validate({ name }: OfferContent): InvalidOfferError | null {
    return name.length
      ? null
      : new InvalidOfferError('Informe o nome da oferta.');
  }
}
