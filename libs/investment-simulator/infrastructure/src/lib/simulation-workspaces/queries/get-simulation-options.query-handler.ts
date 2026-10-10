import { Injectable } from '@nestjs/common';
import {
  InvestmentCalculator,
  CDB_INCOME_TAX_BRACKETS,
  CDB_IOF_DAILY_RATES,
  CDB_IOF_EXEMPT_FROM_CALENDAR_DAYS,
  RemunerationKind,
  RemunerationTerms,
  ETitleType,
  UnsupportedCalculationCode,
} from '@investflow/investment-simulator-domain';
import { QueryHandler } from '@investflow/shared-application';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { SimulationWorkspaceQueryError } from './simulation-workspace-query.error';

type EEconomicIndex = 'CDI' | 'SELIC' | 'IPCA';

export interface CurveOption {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  // First and last covered dates; gaps between intervals are still reported
  // when a calculation needs them.
  readonly coverage: { readonly startDate: string; readonly endDate: string };
}

export interface GetSimulationOptionsOutput {
  readonly issuers: readonly { readonly id: string; readonly name: string }[];
  readonly remunerations: readonly {
    readonly kind: RemunerationKind;
    readonly index: EEconomicIndex | null;
    readonly unsupportedReason: UnsupportedCalculationCode | null;
    readonly curves: readonly CurveOption[];
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
  readonly offers: readonly {
    readonly id: string;
    readonly titleType: 'CDB' | 'LCI' | 'LCA';
    readonly issuer: { readonly id: string; readonly name: string };
    readonly maturityDate: string;
    readonly redemptionTerms: { readonly kind: 'AT_MATURITY' | 'DAILY' };
    readonly remunerationTerms: {
      readonly kind: RemunerationKind;
      readonly rate: string;
    };
    readonly unsupportedReason: UnsupportedCalculationCode | null;
  }[];
}

const REMUNERATION_KINDS: readonly RemunerationKind[] = [
  'PREFIXED',
  'CDI_PERCENTAGE',
  'SELIC_PERCENTAGE',
  'IPCA_PLUS',
];

const TAX_RULES: GetSimulationOptionsOutput['taxRules'] = {
  iof: {
    exemptFromCalendarDays: CDB_IOF_EXEMPT_FROM_CALENDAR_DAYS,
    dailyRates: CDB_IOF_DAILY_RATES.map(({ calendarDay, rate }) => ({
      calendarDay,
      rate: rate.value.toFixed(),
    })),
  },
  incomeTax: {
    brackets: CDB_INCOME_TAX_BRACKETS.map((bracket) => ({
      fromCalendarDays: bracket.fromCalendarDays,
      upToCalendarDays: bracket.upToCalendarDays,
      rate: bracket.rate.value.toFixed(),
    })),
  },
};

const curveSelect = {
  id: true,
  name: true,
  description: true,
  index: true,
  intervals: {
    select: { startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
  },
} satisfies Prisma.IndexCurveSelect;

const offerSelect = {
  id: true,
  titleType: true,
  issuer: { select: { id: true, name: true } },
  maturityDate: true,
  redemptionType: true,
  remunerationType: true,
  rateValue: true,
} satisfies Prisma.InvestmentOfferSelect;

type CurveRecord = Prisma.IndexCurveGetPayload<{ select: typeof curveSelect }>;
type OfferRecord = Prisma.InvestmentOfferGetPayload<{
  select: typeof offerSelect;
}>;

@Injectable()
export class GetSimulationOptionsQueryHandler
  implements QueryHandler<void, GetSimulationOptionsOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  execute(): Promise<
    Result<GetSimulationOptionsOutput, SimulationWorkspaceQueryError>
  > {
    return Result.fromPromise(
      async () => {
        const [issuers, curves, offers] = await Promise.all([
          this.prisma.client.investmentIssuer.findMany({
            select: { id: true, name: true },
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          }),
          // Deleted curves cannot be linked to simulations.
          this.prisma.client.indexCurve.findMany({
            where: { deletedAt: null },
            select: curveSelect,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
          }),
          this.prisma.client.investmentOffer.findMany({
            where: { deletedAt: null },
            select: offerSelect,
            orderBy: [
              { issuer: { name: 'asc' } },
              { maturityDate: 'asc' },
              { id: 'asc' },
            ],
          }),
        ]);
        return {
          issuers,
          remunerations: REMUNERATION_KINDS.map((kind) => {
            const index = RemunerationTerms.requiredIndex(kind);
            return {
              kind,
              index,
              unsupportedReason: InvestmentCalculator.unsupportedReason(ETitleType.CDB, kind),
              curves: index
                ? curves
                    .filter((curve) => curve.index === index)
                    .map((curve) => this.toCurveOption(curve))
                : [],
            };
          }),
          offers: offers.map((offer) => this.toOfferOption(offer)),
          taxRules: TAX_RULES,
        };
      },
      (cause) => new SimulationWorkspaceQueryError(cause),
    );
  }

  private toCurveOption(record: CurveRecord): CurveOption {
    const ends = record.intervals.map(({ endDate }) => endDate.getTime());
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      coverage: {
        startDate: CalendarDate.fromUtcDate(record.intervals[0].startDate).value.toIsoString(),
        endDate: CalendarDate.fromUtcDate(new Date(Math.max(...ends))).value.toIsoString(),
      },
    };
  }

  private toOfferOption(
    record: OfferRecord,
  ): GetSimulationOptionsOutput['offers'][number] {
    return {
      id: record.id,
      titleType: record.titleType,
      issuer: record.issuer,
      maturityDate: CalendarDate.fromUtcDate(record.maturityDate).value.toIsoString(),
      redemptionTerms: { kind: record.redemptionType },
      remunerationTerms: {
        kind: record.remunerationType,
        rate: record.rateValue.toFixed(),
      },
      unsupportedReason: InvestmentCalculator.unsupportedReason(
        record.titleType as ETitleType,
        record.remunerationType,
      ),
    };
  }
}
