import { Injectable } from '@nestjs/common';
import { ApplicationNotFoundError } from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { ApplicationQueryError } from './application-query.error';

export interface GetApplicationQuery {
  readonly ownerId: string;
  readonly applicationId: string;
}

export interface GetApplicationOutput {
  readonly id: string;
  readonly principal: string;
  readonly investmentDate: string;
  readonly indexCurve: { readonly id: string; readonly name: string } | null;
  readonly offer: {
    readonly snapshotId: string;
    readonly sourceOfferId: string | null;
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
  };
}

const applicationSelect = {
  id: true,
  principal: true,
  investmentDate: true,
  indexCurve: { select: { id: true, name: true } },
  offerSnapshot: {
    select: {
      id: true,
      sourceOfferId: true,
      titleType: true,
      issuer: { select: { id: true, name: true } },
      maturityDate: true,
      redemptionType: true,
      remunerationType: true,
      rateValue: true,
    },
  },
} satisfies Prisma.InvestmentApplicationSelect;

type ApplicationRecord = Prisma.InvestmentApplicationGetPayload<{
  select: typeof applicationSelect;
}>;

@Injectable()
export class GetApplicationQueryHandler
  implements QueryHandler<GetApplicationQuery, GetApplicationOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    ownerId,
    applicationId,
  }: GetApplicationQuery): Promise<
    Result<
      GetApplicationOutput,
      ApplicationNotFoundError | ApplicationQueryError
    >
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.investmentApplication.findFirst(
          {
            where: { id: applicationId, ownerId, deletedAt: null },
            select: applicationSelect,
          },
        );
        return record ? this.toOutput(record) : null;
      },
      (cause) => new ApplicationQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new ApplicationNotFoundError(applicationId));
  }

  private toOutput(record: ApplicationRecord): GetApplicationOutput {
    const offer = record.offerSnapshot;
    return {
      id: record.id,
      principal: record.principal.toFixed(),
      investmentDate: CalendarDate.fromUtcDate(
        record.investmentDate,
      ).value.toIsoString(),
      indexCurve: record.indexCurve,
      offer: {
        snapshotId: offer.id,
        sourceOfferId: offer.sourceOfferId,
        titleType: offer.titleType,
        issuer: offer.issuer,
        maturityDate: CalendarDate.fromUtcDate(
          offer.maturityDate,
        ).value.toIsoString(),
        redemptionTerms: { kind: offer.redemptionType },
        remunerationTerms: {
          kind: offer.remunerationType,
          rate: offer.rateValue.toFixed(),
        },
      },
    };
  }
}
