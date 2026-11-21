import {
  OfferNotFoundError,
  OfferRepository,
} from '@investflow/investment-simulator-application';
import {
  EOfferScope,
  ETitleType,
  Offer,
  RedemptionTerms,
  RemunerationTerms,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Rate, Result } from '@investflow/shared-domain';
import {
  PrismaService,
  RepositoryFindError,
} from '@investflow/shared-infrastructure';
import { OfferCopy as OfferCopyRecord } from '@prisma/client';
import type { OfferCopyFields } from './premise-content.events';

export interface OfferCopyChange {
  readonly offerId: string;
  readonly eventId: string;
  readonly revision: number;
  readonly termsRevision: number;
  readonly offer: OfferCopyFields;
}

// The simulations' copy of the offers under V2 and V3: what the worker reads
// instead of the offer table, as a consumer in another service would. Reads
// and writes offer_copy only.
export class OfferCopyRepository extends OfferRepository {
  constructor(
    private readonly prisma: PrismaService,
    // Off with "Write without the revision guard", so a late event
    // overwrites a newer one.
    private readonly isRevisionGuarded: boolean,
  ) {
    super();
  }

  // False when the guard dropped the change as older than the copy.
  async apply(change: OfferCopyChange): Promise<boolean> {
    const client = this.prisma.client;
    const stored = await client.offerCopy.findUnique({
      where: { offerId: change.offerId },
    });
    const fields = {
      ...(change.offer.titleType && { titleType: change.offer.titleType }),
      ...(change.offer.maturityDate && {
        maturityDate: CalendarDate.of(change.offer.maturityDate).toUtcDate(),
      }),
      ...(change.offer.redemptionKind && {
        redemptionType: change.offer.redemptionKind,
      }),
      ...(change.offer.remuneration && {
        remunerationType: change.offer.remuneration.kind,
        rateValue: change.offer.remuneration.rate,
      }),
      ...(change.offer.isDeleted !== undefined && {
        isDeleted: change.offer.isDeleted,
      }),
      revision: change.revision,
      termsRevision: change.termsRevision,
      lastEventId: change.eventId,
    };
    if (!stored) {
      const { titleType, maturityDate, redemptionKind, remuneration } =
        change.offer;
      if (!titleType || !maturityDate || !redemptionKind || !remuneration) {
        // Nothing can rebuild the copy from a delta, so retrying is useless
        // and the message dead-letters.
        throw new Error(
          `No copy of offer ${change.offerId} to apply event ${change.eventId} to`,
        );
      }
      await client.offerCopy.create({
        data: {
          offerId: change.offerId,
          titleType,
          maturityDate: CalendarDate.of(maturityDate).toUtcDate(),
          redemptionType: redemptionKind,
          remunerationType: remuneration.kind,
          rateValue: remuneration.rate,
          isDeleted: change.offer.isDeleted ?? false,
          revision: change.revision,
          termsRevision: change.termsRevision,
          lastEventId: change.eventId,
        },
      });
      return true;
    }
    if (this.isRevisionGuarded && change.revision <= stored.revision) {
      return false;
    }
    await client.offerCopy.update({
      where: { offerId: change.offerId },
      data: fields,
    });
    return true;
  }

  // A missing row is a copy that has not caught up yet, so it fails for a
  // retry; a deleted offer is missing, as in the offer table.
  async findById(
    id: string,
  ): Promise<Result<Offer, OfferNotFoundError | RepositoryFindError>> {
    const found = await Result.fromPromise(
      () => this.prisma.client.offerCopy.findUnique({ where: { offerId: id } }),
      (error) => new RepositoryFindError('OfferCopy', id, error),
    );
    if (found.isErr()) return found;
    if (!found.value) {
      return Result.err(
        new RepositoryFindError(
          'OfferCopy',
          id,
          new Error(`The copy of offer ${id} has no row yet`),
        ),
      );
    }
    if (found.value.isDeleted) return Result.err(new OfferNotFoundError(id));
    return Result.ok(toOffer(found.value));
  }

  save(): Promise<Result<void, RepositoryFindError>> {
    throw new Error('The offer copy is written only by the offer events');
  }
}

// Only the calculation's fields are copied; the rest are placeholders no
// calculation reads.
function toOffer(record: OfferCopyRecord): Offer {
  return Offer.reconstitute({
    id: record.offerId,
    titleType: record.titleType as ETitleType,
    ownerId: null,
    name: null,
    issuerName: null,
    maturityDate: CalendarDate.fromUtcDate(record.maturityDate).value,
    redemptionTerms: RedemptionTerms.create(record.redemptionType),
    remunerationTerms: RemunerationTerms.create(
      record.remunerationType,
      Rate.of(record.rateValue.toString()),
    ),
    revision: record.revision,
    termsRevision: record.termsRevision,
    scope: EOfferScope.CATALOG,
    basedOnOfferId: null,
    deletedAt: null,
  });
}
