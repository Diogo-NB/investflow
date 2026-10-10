import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@investflow/shared-application';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { OfferNotFoundError } from '@investflow/investment-simulator-application';
import { PrismaService } from '@investflow/shared-infrastructure';
import { OfferQueryError } from './offer-query.error';
import { Prisma } from '@prisma/client';

export interface GetOfferQuery {
  readonly offerId: string;
}

export interface GetOfferOutput {
  readonly id: string;
  readonly titleType: 'CDB' | 'LCI' | 'LCA';
  readonly issuer: { readonly id: string; readonly name: string };
  readonly maturityDate: string;
  readonly redemptionTerms: { readonly kind: 'AT_MATURITY' | 'DAILY' };
  readonly remunerationTerms: {
    readonly kind:
      | 'PREFIXED'
      | 'IPCA_PLUS'
      | 'CDI_PERCENTAGE'
      | 'SELIC_PERCENTAGE';
    readonly rate: string;
  };
}

const offerSelect = {
  id: true,
  titleType: true,
  issuer: { select: { id: true, name: true } },
  maturityDate: true,
  redemptionType: true,
  remunerationType: true,
  rateValue: true,
} satisfies Prisma.InvestmentOfferSelect;

type OfferRecord = Prisma.InvestmentOfferGetPayload<{
  select: typeof offerSelect;
}>;

@Injectable()
export class GetOfferQueryHandler
  implements QueryHandler<GetOfferQuery, GetOfferOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    offerId,
  }: GetOfferQuery): Promise<
    Result<GetOfferOutput, OfferNotFoundError | OfferQueryError>
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.investmentOffer.findUnique({
          where: { id: offerId, sourceOfferId: null, deletedAt: null },
          select: offerSelect,
        });
        return record ? this.toOutput(record) : null;
      },
      (cause) => new OfferQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new OfferNotFoundError(offerId));
  }

  private toOutput(record: OfferRecord): GetOfferOutput {
    return {
      id: record.id,
      titleType: record.titleType,
      issuer: { id: record.issuer.id, name: record.issuer.name },
      maturityDate: CalendarDate.fromUtcDate(
        record.maturityDate,
      ).value.toIsoString(),
      redemptionTerms: { kind: record.redemptionType },
      remunerationTerms: {
        kind: record.remunerationType,
        rate: record.rateValue.toFixed(),
      },
    };
  }
}
