import { OfferNotFoundError } from '@investflow/investment-simulator-application';
import { Offer } from '@investflow/investment-simulator-domain';
import {
  DomainEvent,
  DomainEventRecorder,
  Result,
} from '@investflow/shared-domain';
import {
  EExperimentEventContent,
  PrismaService,
  RepositoryFindError,
} from '@investflow/shared-infrastructure';
import { PrismaOfferRepository } from '../../offers/persistence/prisma-offer.repository';
import {
  type CompleteOfferCopyFields,
  type ContentCarryingEventContent,
  OfferContentEvent,
  offerCopyFieldsOf,
  type OfferCopyFields,
} from './premise-content.events';

// The offer events the simulations' copy follows.
const copiedEventTypes = new Set([
  'OfferCreated',
  'OfferTermsChanged',
  'OfferDeleted',
]);

// V2 and V3 on the producer's side: the offer events the copy follows carry
// the delta or the whole state instead of the id alone.
export class ContentCarryingOfferRepository extends PrismaOfferRepository {
  // The fields each aggregate had when it was read or last saved; a V2 delta
  // is what differs from them, and everything for a new offer.
  private readonly storedFields = new WeakMap<Offer, CompleteOfferCopyFields>();

  constructor(
    prisma: PrismaService,
    events: DomainEventRecorder,
    private readonly content: ContentCarryingEventContent,
  ) {
    super(prisma, events);
  }

  override async findById(
    id: string,
  ): Promise<Result<Offer, OfferNotFoundError | RepositoryFindError>> {
    const found = await super.findById(id);
    if (found.isOk())
      this.storedFields.set(found.value, offerCopyFieldsOf(found.value));
    return found;
  }

  protected override eventsToRecord(offer: Offer): DomainEvent[] {
    const current = offerCopyFieldsOf(offer);
    const stored = this.storedFields.get(offer) ?? null;
    this.storedFields.set(offer, current);
    return super
      .eventsToRecord(offer)
      .map((event) =>
        copiedEventTypes.has(event.eventType)
          ? new OfferContentEvent(
              event,
              this.content,
              offer.revision,
              offer.termsRevision,
              this.fieldsToSend(current, stored),
            )
          : event,
      );
  }

  private fieldsToSend(
    current: CompleteOfferCopyFields,
    stored: CompleteOfferCopyFields | null,
  ): OfferCopyFields {
    if (this.content === EExperimentEventContent.STATE || !stored)
      return current;
    return {
      ...(current.titleType !== stored.titleType && {
        titleType: current.titleType,
      }),
      ...(current.maturityDate !== stored.maturityDate && {
        maturityDate: current.maturityDate,
      }),
      ...(current.redemptionKind !== stored.redemptionKind && {
        redemptionKind: current.redemptionKind,
      }),
      ...((current.remuneration.kind !== stored.remuneration.kind ||
        current.remuneration.rate !== stored.remuneration.rate) && {
        remuneration: current.remuneration,
      }),
      ...(current.isDeleted !== stored.isDeleted && {
        isDeleted: current.isDeleted,
      }),
    };
  }
}
