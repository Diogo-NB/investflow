import {
  OfferNotFoundError,
  OfferRepository,
} from '@investflow/investment-simulator-application';
import {
  Offer,
  OfferRevisionConflictError,
} from '@investflow/investment-simulator-domain';
import { DomainEventRecorder, Result } from '@investflow/shared-domain';
import {
  BaseRepository,
  PrismaService,
  RepositoryFindError,
  TransactionalPrismaClient,
} from '@investflow/shared-infrastructure';
import { Injectable } from '@nestjs/common';
import { OfferMapper } from './offer.mapper';

@Injectable()
export class PrismaOfferRepository
  extends BaseRepository<Offer>
  implements OfferRepository
{
  // The revision each aggregate had when it was read or last saved; an offer
  // without one is new.
  private readonly storedRevisions = new WeakMap<Offer, number>();

  constructor(prisma: PrismaService, events: DomainEventRecorder) {
    super(prisma, events);
  }

  async findById(
    id: string,
  ): Promise<Result<Offer, OfferNotFoundError | RepositoryFindError>> {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.offer.findUnique({
          where: { id, deletedAt: null },
        });
        return record ? OfferMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('Offer', id, error),
    );
    if (result.isErr()) return result;
    if (!result.value) return Result.err(new OfferNotFoundError(id));
    this.storedRevisions.set(result.value, result.value.revision);
    return Result.ok(result.value);
  }

  protected async persistAggregate(
    offer: Offer,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const stored = this.storedRevisions.get(offer);
    if (stored === offer.revision) return;

    const data = OfferMapper.toPersistence(offer);
    if (stored === undefined) {
      await client.offer.create({ data });
    } else {
      const { count } = await client.offer.updateMany({
        where: { id: offer.id, revision: stored },
        data,
      });
      if (count === 0) throw new OfferRevisionConflictError(offer.id, stored);
    }
    this.storedRevisions.set(offer, offer.revision);
  }
}
