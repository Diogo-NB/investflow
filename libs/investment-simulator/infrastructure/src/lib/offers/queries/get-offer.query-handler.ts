import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import { Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '@investflow/investment-simulator-application';
import { PrismaService } from '@investflow/shared-infrastructure';
import { OfferQueryError } from './offer-query.error';
import {
  OfferSummary,
  offerSummarySelect,
  toOfferSummary,
  catalogOfferWhere,
} from './offer-projection';

export interface GetOfferQuery {
  readonly viewerId: string;
  readonly offerId: string;
}

export type GetOfferOutput = OfferSummary;

@Injectable()
export class GetOfferQueryHandler
  implements QueryHandler<GetOfferQuery, GetOfferOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: GetOfferQuery,
  ): Promise<Result<GetOfferOutput, OfferNotFoundError | OfferQueryError>> {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.offer.findFirst({
          where: { id: query.offerId, ...catalogOfferWhere(query.viewerId) },
          select: offerSummarySelect,
        });
        return record ? toOfferSummary(record) : null;
      },
      (cause) => new OfferQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new OfferNotFoundError(query.offerId));
  }
}
