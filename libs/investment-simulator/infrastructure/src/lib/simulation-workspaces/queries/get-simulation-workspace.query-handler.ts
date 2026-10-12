import { Injectable } from '@nestjs/common';
import { SimulationNotFoundError } from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import {
  ETitleType,
  IOF_EXEMPT_FROM_CALENDAR_DAYS,
  SimulationResult,
  SimulationResultInputs,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import {
  OfferSummary,
  offerSummarySelect,
  toOfferSummary,
} from '../../offers/queries/offer-projection';
import { SimulationWorkspaceQueryError } from './simulation-workspace-query.error';

export interface GetSimulationWorkspaceQuery {
  readonly ownerId: string;
  readonly simulationId: string;
}

export interface InvestmentOutput {
  readonly principal: string;
  readonly investmentDate: string;
  readonly curveId: string | null;
}

export interface SimulationResultSummary {
  readonly calculatedAt: string;
  // The period calculated, which later edits may have changed.
  readonly investmentDate: string;
  readonly maturityDate: string;
  readonly methodologyVersion: string;
  // True when the simulation, its offer or curve changed since, or the current
  // methodology could produce different figures.
  readonly outdated: boolean;
  // Business days with a balance, the last one being maturity.
  readonly businessDays: number;
  readonly maturitySummary: {
    readonly principal: string;
    readonly grossBalance: string;
    readonly grossEarnings: string;
    readonly iof: string;
    readonly incomeTax: string;
    readonly totalTaxes: string;
    readonly netBalance: string;
  };
  readonly taxes: {
    readonly holdingPeriodCalendarDays: number;
    // rate is null when the holding period is exempt from IOF.
    // formula is the calculation written out with its values, for display.
    readonly iof: {
      readonly base: string;
      readonly rate: string | null;
      readonly amount: string;
      readonly formula: string;
    };
    // rate is null when the title type is exempt from income tax.
    readonly incomeTax: {
      readonly base: string;
      readonly rate: string | null;
      readonly amount: string;
      readonly formula: string;
    };
  };
}

export interface GetSimulationWorkspaceOutput {
  readonly simulation: {
    readonly id: string;
    readonly revision: number;
    readonly investment: InvestmentOutput;
  };
  // Also when deleted, so the screen can ask for another one.
  readonly offer: OfferSummary & { readonly deleted: boolean };
  readonly curve: {
    readonly id: string;
    readonly name: string;
    readonly deleted: boolean;
  } | null;
  // Null until the first successful calculation.
  readonly result: SimulationResultSummary | null;
}

const resultSelect = {
  simulationRevision: true,
  offerRevision: true,
  curveRevision: true,
  methodologyVersion: true,
  calculatedAt: true,
  investmentDate: true,
  maturityDate: true,
  principal: true,
  grossBalance: true,
  grossEarnings: true,
  iof: true,
  incomeTax: true,
  totalTaxes: true,
  netBalance: true,
  holdingPeriodCalendarDays: true,
  taxableEarnings: true,
  incomeTaxBase: true,
  iofRate: true,
  incomeTaxRate: true,
  _count: { select: { balances: true } },
} satisfies Prisma.SimulationResultSelect;

type NumericString = `${number}`;

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const percent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 4,
});

// Intl formats numeric strings exactly, rounding only the displayed digits.
const asNumeric = (value: Prisma.Decimal) => value.toFixed() as NumericString;

function taxFormula(
  base: Prisma.Decimal,
  rate: Prisma.Decimal,
  amount: Prisma.Decimal,
): string {
  return `${money.format(asNumeric(base))} × ${percent.format(asNumeric(rate))} = ${money.format(asNumeric(amount))}`;
}

const IOF_EXEMPT_FORMULA = `Isento: prazo de ${IOF_EXEMPT_FROM_CALENDAR_DAYS} dias ou mais`;
const INCOME_TAX_EXEMPT_FORMULA = 'Isento: LCI e LCA de pessoa física';

const workspaceSelect = {
  id: true,
  revision: true,
  principal: true,
  investmentDate: true,
  curveId: true,
  offer: { select: { ...offerSummarySelect, deletedAt: true } },
  curve: { select: { id: true, name: true, revision: true, deletedAt: true } },
  result: { select: resultSelect },
} satisfies Prisma.SimulationSelect;

type WorkspaceRecord = Prisma.SimulationGetPayload<{
  select: typeof workspaceSelect;
}>;

type ResultRecord = NonNullable<WorkspaceRecord['result']>;

@Injectable()
export class GetSimulationWorkspaceQueryHandler
  implements
    QueryHandler<GetSimulationWorkspaceQuery, GetSimulationWorkspaceOutput>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    ownerId,
    simulationId,
  }: GetSimulationWorkspaceQuery): Promise<
    Result<
      GetSimulationWorkspaceOutput,
      SimulationNotFoundError | SimulationWorkspaceQueryError
    >
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulation.findFirst({
          where: { id: simulationId, ownerId, deletedAt: null },
          select: workspaceSelect,
        });
        return record ? this.toOutput(record) : null;
      },
      (cause) => new SimulationWorkspaceQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new SimulationNotFoundError(simulationId));
  }

  private toOutput(record: WorkspaceRecord): GetSimulationWorkspaceOutput {
    const { offer, curve } = record;
    return {
      simulation: {
        id: record.id,
        revision: record.revision,
        investment: {
          principal: record.principal.toFixed(),
          investmentDate: CalendarDate.fromUtcDate(
            record.investmentDate,
          ).value.toIsoString(),
          curveId: record.curveId,
        },
      },
      offer: { ...toOfferSummary(offer), deleted: offer.deletedAt !== null },
      curve: curve
        ? { id: curve.id, name: curve.name, deleted: curve.deletedAt !== null }
        : null,
      result: record.result
        ? this.toResultSummary(
            record.result,
            SimulationResult.targetFor(
              record.revision,
              offer.titleType as ETitleType,
              offer.revision,
              curve?.revision ?? null,
            ),
          )
        : null,
    };
  }

  private toResultSummary(
    calculation: ResultRecord,
    target: SimulationResultInputs,
  ): SimulationResultSummary {
    return {
      calculatedAt: calculation.calculatedAt.toISOString(),
      investmentDate: CalendarDate.fromUtcDate(
        calculation.investmentDate,
      ).value.toIsoString(),
      maturityDate: CalendarDate.fromUtcDate(
        calculation.maturityDate,
      ).value.toIsoString(),
      methodologyVersion: calculation.methodologyVersion,
      outdated: !SimulationResult.isCurrent(calculation, target),
      businessDays: calculation._count.balances,
      maturitySummary: {
        principal: calculation.principal.toFixed(),
        grossBalance: calculation.grossBalance.toFixed(),
        grossEarnings: calculation.grossEarnings.toFixed(),
        iof: calculation.iof.toFixed(),
        incomeTax: calculation.incomeTax.toFixed(),
        totalTaxes: calculation.totalTaxes.toFixed(),
        netBalance: calculation.netBalance.toFixed(),
      },
      taxes: {
        holdingPeriodCalendarDays: calculation.holdingPeriodCalendarDays,
        iof: {
          base: calculation.taxableEarnings.toFixed(),
          rate: calculation.iofRate?.toFixed() ?? null,
          amount: calculation.iof.toFixed(),
          formula: calculation.iofRate
            ? taxFormula(
                calculation.taxableEarnings,
                calculation.iofRate,
                calculation.iof,
              )
            : IOF_EXEMPT_FORMULA,
        },
        incomeTax: {
          base: calculation.incomeTaxBase.toFixed(),
          rate: calculation.incomeTaxRate?.toFixed() ?? null,
          amount: calculation.incomeTax.toFixed(),
          formula: calculation.incomeTaxRate
            ? taxFormula(
                calculation.incomeTaxBase,
                calculation.incomeTaxRate,
                calculation.incomeTax,
              )
            : INCOME_TAX_EXEMPT_FORMULA,
        },
      },
    };
  }
}
