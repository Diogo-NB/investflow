import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import { Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '@investflow/investment-simulator-application';
import { PrismaService } from '@investflow/shared-infrastructure';
import { OfferQueryError } from './offer-query.error';
import {
  OfferReadModel,
  offerReadSelect,
  toOfferReadModel,
} from './offer-read-model.type';

@Injectable()
export class GetOfferQueryHandler
  implements
    QueryHandler<
      { offerId: string },
      OfferReadModel,
      OfferNotFoundError | OfferQueryError
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    offerId,
  }: {
    offerId: string;
  }): Promise<Result<OfferReadModel, OfferNotFoundError | OfferQueryError>> {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.investmentOffer.findUnique({
          where: { id: offerId, deletedAt: null },
          select: offerReadSelect,
        });
        return record ? toOfferReadModel(record) : null;
      },
      (cause) => new OfferQueryError(cause),
    );
    return result.andThen((offer) =>
      offer ? Result.ok(offer) : Result.err(new OfferNotFoundError(offerId)),
    );
  }
}
