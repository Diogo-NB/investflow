import { Injectable } from '@nestjs/common';
import {
  InvestmentCalculator,
  INCOME_TAX_BRACKETS,
  IOF_DAILY_RATES,
  IOF_EXEMPT_FROM_CALENDAR_DAYS,
  RemunerationKind,
  RemunerationTerms,
  TITLE_TYPE_RULES,
  UnsupportedCalculationCode,
} from '@investflow/investment-simulator-domain';
import { QueryHandler } from '@investflow/shared-application';
import { Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import {
  CurveSummary,
  curveSummaryOrder,
  curveSummarySelect,
  toCurveSummary,
  visibleCurveWhere,
} from '../../curves/queries/curve-projection';
import {
  OfferSummary,
  offerSummaryOrder,
  offerSummarySelect,
  toOfferSummary,
  visibleOfferWhere,
} from '../../offers/queries/offer-projection';
import { SimulationWorkspaceQueryError } from './simulation-workspace-query.error';

type EEconomicIndex = 'CDI' | 'SELIC' | 'IPCA';

export interface GetSimulationOptionsQuery {
  readonly viewerId: string;
}

type TitleType = 'CDB' | 'LCI' | 'LCA';

export interface GetSimulationOptionsOutput {
  readonly titleTypes: readonly {
    readonly titleType: TitleType;
    readonly incomeTaxExempt: boolean;
    readonly minimumTermMonths: number | null;
  }[];
  readonly remunerations: readonly {
    readonly kind: RemunerationKind;
    readonly index: EEconomicIndex | null;
    readonly unsupportedReason: UnsupportedCalculationCode | null;
    // Visible curves of this kind's index.
    readonly curves: readonly CurveSummary[];
  }[];
  readonly taxRules: {
    readonly iof: {
      readonly exemptFromCalendarDays: number;
      readonly dailyRates: readonly {
        readonly calendarDay: number;
        readonly rate: string;
      }[];
    };
    readonly incomeTax: {
      readonly brackets: readonly {
        readonly fromCalendarDays: number;
        readonly upToCalendarDays: number | null;
        readonly rate: string;
      }[];
    };
  };
  // Visible offers.
  readonly offers: readonly (OfferSummary & {
    readonly unsupportedReason: UnsupportedCalculationCode | null;
  })[];
}

const REMUNERATION_KINDS: readonly RemunerationKind[] = [
  'PREFIXED',
  'CDI_PERCENTAGE',
  'SELIC_PERCENTAGE',
  'IPCA_PLUS',
];

const TITLE_TYPES: GetSimulationOptionsOutput['titleTypes'] = Object.entries(
  TITLE_TYPE_RULES,
).map(([titleType, rules]) => ({
  titleType: titleType as TitleType,
  incomeTaxExempt: rules.incomeTax === null,
  minimumTermMonths: rules.minimumTermMonths,
}));

const TAX_RULES: GetSimulationOptionsOutput['taxRules'] = {
  iof: {
    exemptFromCalendarDays: IOF_EXEMPT_FROM_CALENDAR_DAYS,
    dailyRates: IOF_DAILY_RATES.map(({ calendarDay, rate }) => ({
      calendarDay,
      rate: rate.value.toFixed(),
    })),
  },
  incomeTax: {
    brackets: INCOME_TAX_BRACKETS.map((bracket) => ({
      fromCalendarDays: bracket.fromCalendarDays,
      upToCalendarDays: bracket.upToCalendarDays,
      rate: bracket.rate.value.toFixed(),
    })),
  },
};

@Injectable()
export class GetSimulationOptionsQueryHandler
  implements QueryHandler<GetSimulationOptionsQuery, GetSimulationOptionsOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  execute(
    query: GetSimulationOptionsQuery,
  ): Promise<
    Result<GetSimulationOptionsOutput, SimulationWorkspaceQueryError>
  > {
    return Result.fromPromise(
      async () => {
        const [curves, offers] = await Promise.all([
          this.prisma.client.curve.findMany({
            where: visibleCurveWhere(query.viewerId),
            select: curveSummarySelect,
            orderBy: curveSummaryOrder,
          }),
          this.prisma.client.offer.findMany({
            where: visibleOfferWhere(query.viewerId),
            select: offerSummarySelect,
            orderBy: offerSummaryOrder,
          }),
        ]);
        return {
          titleTypes: TITLE_TYPES,
          remunerations: REMUNERATION_KINDS.map((kind) => {
            const index = RemunerationTerms.requiredIndex(kind);
            return {
              kind,
              index,
              unsupportedReason: InvestmentCalculator.unsupportedReason(kind),
              curves: index
                ? curves
                    .filter((curve) => curve.index === index)
                    .map((curve) => toCurveSummary(curve))
                : [],
            };
          }),
          offers: offers.map((record) => ({
            ...toOfferSummary(record),
            unsupportedReason: InvestmentCalculator.unsupportedReason(
              record.remunerationType,
            ),
          })),
          taxRules: TAX_RULES,
        };
      },
      (cause) => new SimulationWorkspaceQueryError(cause),
    );
  }
}
