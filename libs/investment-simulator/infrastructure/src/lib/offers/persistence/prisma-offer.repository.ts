import {
  OfferNotFoundError,
  OfferRepository,
} from '@investflow/investment-simulator-application';
import { Offer } from '@investflow/investment-simulator-domain';
import { Result } from '@investflow/shared-domain';
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
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findById(
    id: string,
  ): Promise<Result<Offer, OfferNotFoundError | RepositoryFindError>> {
    const offerResult = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.investmentOffer.findUnique({
          where: { id, deletedAt: null },
        });

        return record ? OfferMapper.toDomain(record) : null;
      },
      (error) => new RepositoryFindError('Offer', id, error),
    );

    return offerResult.andThen((offer) =>
      offer ? Result.ok(offer) : Result.err(new OfferNotFoundError(id)),
    );
  }

  protected async persistAggregate(
    offer: Offer,
    client: TransactionalPrismaClient,
  ): Promise<void> {
    const data = OfferMapper.toPersistence(offer);
    const { id, ...update } = data;

    await client.investmentOffer.upsert({
      where: { id },
      create: data,
      update,
    });
  }
}
