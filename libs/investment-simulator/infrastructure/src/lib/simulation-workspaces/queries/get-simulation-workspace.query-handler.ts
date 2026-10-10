import { Injectable } from '@nestjs/common';
import { SimulationNotFoundError } from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import {
  CDB_IOF_EXEMPT_FROM_CALENDAR_DAYS,
  SimulationCalculation,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { SimulationWorkspaceQueryError } from './simulation-workspace-query.error';

export interface GetSimulationWorkspaceQuery {
  readonly ownerId: string;
  readonly simulationId: string;
}

export interface CalculationInputsOutput {
  readonly principal: string;
  readonly investmentDate: string;
  readonly indexCurveId: string | null;
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

export interface CalculationSummary {
  readonly id: string;
  readonly calculatedAt: string;
  readonly methodologyVersion: string;
  // True when the current methodology could produce different figures.
  readonly outdated: boolean;
  readonly inputs: CalculationInputsOutput;
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
    readonly incomeTax: {
      readonly base: string;
      readonly rate: string;
      readonly amount: string;
      readonly formula: string;
    };
  };
}

export interface GetSimulationWorkspaceOutput {
  readonly simulation: {
    readonly id: string;
    readonly fromCatalogOffer: boolean;
  };
  // Newest first and never empty; the first one holds the current inputs.
  readonly calculations: readonly CalculationSummary[];
}

const calculationSelect = {
  id: true,
  calculatedAt: true,
  methodologyVersion: true,
  principal: true,
  investmentDate: true,
  indexCurveId: true,
  titleType: true,
  issuer: { select: { id: true, name: true } },
  maturityDate: true,
  redemptionType: true,
  remunerationType: true,
  rateValue: true,
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
} satisfies Prisma.SimulationCalculationSelect;

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

const IOF_EXEMPT_FORMULA = `Isento: prazo de ${CDB_IOF_EXEMPT_FROM_CALENDAR_DAYS} dias ou mais`;

const workspaceSelect = {
  id: true,
  sourceOfferId: true,
  calculations: {
    select: calculationSelect,
    orderBy: { calculatedAt: 'desc' },
  },
} satisfies Prisma.SimulationSelect;

type WorkspaceRecord = Prisma.SimulationGetPayload<{
  select: typeof workspaceSelect;
}>;

type CalculationRecord = WorkspaceRecord['calculations'][number];

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
    return {
      simulation: {
        id: record.id,
        fromCatalogOffer: record.sourceOfferId !== null,
      },
      calculations: record.calculations.map((calculation) =>
        this.toCalculationSummary(calculation),
      ),
    };
  }

  private toCalculationSummary(calculation: CalculationRecord): CalculationSummary {
    return {
      id: calculation.id,
      calculatedAt: calculation.calculatedAt.toISOString(),
      methodologyVersion: calculation.methodologyVersion,
      outdated: SimulationCalculation.isOutdated(calculation.methodologyVersion),
      inputs: {
        principal: calculation.principal.toFixed(),
        investmentDate: CalendarDate.fromUtcDate(
          calculation.investmentDate,
        ).value.toIsoString(),
        indexCurveId: calculation.indexCurveId,
        titleType: calculation.titleType,
        issuer: calculation.issuer,
        maturityDate: CalendarDate.fromUtcDate(
          calculation.maturityDate,
        ).value.toIsoString(),
        redemptionTerms: { kind: calculation.redemptionType },
        remunerationTerms: {
          kind: calculation.remunerationType,
          rate: calculation.rateValue.toFixed(),
        },
      },
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
            ? taxFormula(calculation.taxableEarnings, calculation.iofRate, calculation.iof)
            : IOF_EXEMPT_FORMULA,
        },
        incomeTax: {
          base: calculation.incomeTaxBase.toFixed(),
          rate: calculation.incomeTaxRate.toFixed(),
          amount: calculation.incomeTax.toFixed(),
          formula: taxFormula(
            calculation.incomeTaxBase,
            calculation.incomeTaxRate,
            calculation.incomeTax,
          ),
        },
      },
    };
  }
}
