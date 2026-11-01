import {
  CalendarDate,
  AggregateRoot,
  generateUuid,
  Result,
  Revision,
  UtcInstant,
} from '@investflow/shared-domain';
import { OfferRevisionConflictError } from './offer.error';
import {
  OfferCreated,
  OfferDeleted,
  OfferDetailsChanged,
  OfferMovedToCatalog,
  OfferTermsChanged,
} from './offer.events';
import { EOfferScope } from './offer-scope.enum';
import type { RedemptionTerms } from './terms/redemption/redemption-terms.vo';
import type { RemunerationTerms } from './terms/remuneration/remuneration-terms.vo';
import { ETitleType } from './title-type.enum';

export interface OfferContent {
  // The user's own label; the terms already identify the offer.
  readonly name: string | null;
  readonly issuerName: string | null;
  readonly maturityDate: CalendarDate;
  readonly redemptionTerms: RedemptionTerms;
  readonly remunerationTerms: RemunerationTerms;
}

// Changed only by behavior methods; readonly fields never change.
interface OfferProps {
  // Fixes the methodology and taxation.
  readonly titleType: ETitleType;
  readonly ownerId: string | null;
  name: string | null;
  issuerName: string | null;
  maturityDate: CalendarDate;
  redemptionTerms: RedemptionTerms;
  remunerationTerms: RemunerationTerms;
  // Where the offer can be used.
  scope: EOfferScope;
  // The offer a simulation's own terms came from; set only in the SIMULATION
  // scope, and null for terms typed from scratch.
  basedOnOfferId: string | null;
  deletedAt: UtcInstant | null;
}

export type CreateOfferProps = Pick<
  OfferProps,
  | 'titleType'
  | 'ownerId'
  | 'maturityDate'
  | 'redemptionTerms'
  | 'remunerationTerms'
> & { readonly name?: string | null; readonly issuerName?: string | null };

export type CreateSimulationScopedOfferProps = CreateOfferProps & {
  // Simulation-scoped offers always belong to a user.
  readonly ownerId: string;
  readonly basedOnOfferId: string | null;
};

export type ReconstituteOfferProps = OfferProps & {
  readonly id: string;
  readonly revision: number;
  readonly termsRevision: number;
};

export type OfferEdit = Partial<OfferContent>;

export class Offer extends AggregateRoot {
  private constructor(
    id: string,
    private readonly props: OfferProps,
    revision: Revision,
    // Raised only by changes to what a calculation reads, so results stay
    // current across renames.
    private readonly termsRevisionTracker: Revision,
  ) {
    super(id, revision);
  }

  /** A catalog offer, listed in Ofertas. */
  static create(props: CreateOfferProps, occurredAt: UtcInstant): Offer {
    return Offer.createIn(props, EOfferScope.CATALOG, null, occurredAt);
  }

  /** A simulation's own terms, used by that simulation only. */
  static createSimulationScoped(
    props: CreateSimulationScopedOfferProps,
    occurredAt: UtcInstant,
  ): Offer {
    return Offer.createIn(
      props,
      EOfferScope.SIMULATION,
      props.basedOnOfferId,
      occurredAt,
    );
  }

  private static createIn(
    props: CreateOfferProps,
    scope: EOfferScope,
    basedOnOfferId: string | null,
    occurredAt: UtcInstant,
  ): Offer {
    const content = Offer.normalize({
      name: props.name ?? null,
      issuerName: props.issuerName ?? null,
      maturityDate: props.maturityDate,
      redemptionTerms: props.redemptionTerms,
      remunerationTerms: props.remunerationTerms,
    });
    const offer = new Offer(
      generateUuid(),
      {
        ...content,
        titleType: props.titleType,
        ownerId: props.ownerId,
        scope,
        basedOnOfferId,
        deletedAt: null,
      },
      Revision.initial(),
      Revision.initial(),
    );
    return offer.apply(new OfferCreated(offer.id, occurredAt));
  }

  static reconstitute(props: ReconstituteOfferProps): Offer {
    const { id, revision, termsRevision, ...state } = props;
    return new Offer(
      id,
      state,
      Revision.restore(revision),
      Revision.restore(termsRevision),
    );
  }

  get termsRevision(): number {
    return this.termsRevisionTracker.value;
  }

  get titleType(): ETitleType {
    return this.props.titleType;
  }

  get ownerId(): string | null {
    return this.props.ownerId;
  }

  get name(): string | null {
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

  get scope(): EOfferScope {
    return this.props.scope;
  }

  get basedOnOfferId(): string | null {
    return this.props.basedOnOfferId;
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
    return expected === this.revision
      ? Result.ok(this)
      : Result.err(new OfferRevisionConflictError(this.id, expected));
  }

  // A private copy for the actor, including of a system offer. A
  // simulation's own terms stay simulation-scoped with the same base, so a
  // duplicated simulation gets its own copy.
  duplicateFor(ownerId: string | null, occurredAt: UtcInstant): Offer {
    const scope = ownerId === null ? EOfferScope.CATALOG : this.props.scope;
    return Offer.createIn(
      {
        titleType: this.props.titleType,
        ownerId,
        name: this.props.name && `${this.props.name} (cópia)`,
        issuerName: this.props.issuerName,
        maturityDate: this.props.maturityDate,
        redemptionTerms: this.props.redemptionTerms,
        remunerationTerms: this.props.remunerationTerms,
      },
      scope,
      scope === EOfferScope.SIMULATION ? this.props.basedOnOfferId : null,
      occurredAt,
    );
  }

  /** Lists a simulation's own terms in Ofertas; the simulation keeps using them. */
  moveToCatalog(occurredAt: UtcInstant): this {
    if (this.props.scope === EOfferScope.CATALOG) return this;
    this.props.scope = EOfferScope.CATALOG;
    this.props.basedOnOfferId = null;
    this.revisionTracker.increment();
    return this.apply(new OfferMovedToCatalog(this.id, occurredAt));
  }

  edit(edit: OfferEdit, occurredAt: UtcInstant): this {
    const content = Offer.normalize({
      name: edit.name === undefined ? this.props.name : edit.name,
      issuerName:
        edit.issuerName === undefined ? this.props.issuerName : edit.issuerName,
      maturityDate: edit.maturityDate ?? this.props.maturityDate,
      redemptionTerms: edit.redemptionTerms ?? this.props.redemptionTerms,
      remunerationTerms: edit.remunerationTerms ?? this.props.remunerationTerms,
    });
    const termsChanged = !this.hasTerms(content);
    const detailsChanged = !this.hasDetails(content);
    if (!termsChanged && !detailsChanged) return this;

    this.props.name = content.name;
    this.props.issuerName = content.issuerName;
    this.props.maturityDate = content.maturityDate;
    this.props.redemptionTerms = content.redemptionTerms;
    this.props.remunerationTerms = content.remunerationTerms;
    this.revisionTracker.increment();
    if (termsChanged) {
      this.termsRevisionTracker.increment();
      this.apply(new OfferTermsChanged(this.id, occurredAt));
    }
    if (detailsChanged)
      this.apply(new OfferDetailsChanged(this.id, occurredAt));
    return this;
  }

  delete(at: UtcInstant): this {
    if (this.props.deletedAt) return this;
    this.props.deletedAt = at;
    this.revisionTracker.increment();
    return this.apply(new OfferDeleted(this.id, at));
  }

  override markPersisted(): this {
    this.termsRevisionTracker.markPersisted();
    return super.markPersisted();
  }

  // Liquidity is a detail until early redemption is calculated.
  private hasTerms(content: OfferContent): boolean {
    return (
      content.maturityDate.equals(this.props.maturityDate) &&
      content.remunerationTerms.equals(this.props.remunerationTerms)
    );
  }

  private hasDetails(content: OfferContent): boolean {
    return (
      content.name === this.props.name &&
      content.issuerName === this.props.issuerName &&
      content.redemptionTerms.equals(this.props.redemptionTerms)
    );
  }

  private static normalize(content: OfferContent): OfferContent {
    return {
      ...content,
      name: content.name?.trim() || null,
      issuerName: content.issuerName?.trim() || null,
    };
  }
}
