import { Injectable } from '@nestjs/common';
import { SimulationCalculationNotFoundError } from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { SimulationCalculationQueryError } from './simulation-calculation-query.error';

export interface ListCalculationMonthlyBalancesQuery {
  readonly ownerId: string;
  readonly calculationId: string;
}

export interface DailyBalanceItem {
  readonly date: string;
  readonly grossBalance: string;
  readonly dailyGrossEarnings: string;
  readonly accumulatedGrossEarnings: string;
}

export interface MonthlyBalanceItem {
  // "YYYY-MM"
  readonly month: string;
  readonly businessDays: number;
  readonly monthGrossEarnings: string;
  // As of the month's last business day.
  readonly accumulatedGrossEarnings: string;
  readonly closingGrossBalance: string;
  readonly days: readonly DailyBalanceItem[];
}

export interface ListCalculationMonthlyBalancesOutput {
  readonly items: readonly MonthlyBalanceItem[];
}

const calculationSelect = {
  balances: {
    select: {
      date: true,
      grossBalance: true,
      dailyGrossEarnings: true,
      accumulatedGrossEarnings: true,
    },
    orderBy: { date: 'asc' },
  },
} satisfies Prisma.SimulationCalculationSelect;

type CalculationRecord = Prisma.SimulationCalculationGetPayload<{
  select: typeof calculationSelect;
}>;
type BalanceRecord = CalculationRecord['balances'][number];

@Injectable()
export class ListCalculationMonthlyBalancesQueryHandler
  implements
    QueryHandler<
      ListCalculationMonthlyBalancesQuery,
      ListCalculationMonthlyBalancesOutput
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    ownerId,
    calculationId,
  }: ListCalculationMonthlyBalancesQuery): Promise<
    Result<
      ListCalculationMonthlyBalancesOutput,
      SimulationCalculationNotFoundError | SimulationCalculationQueryError
    >
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulationCalculation.findFirst(
          {
            // Calculations of deleted simulations are hidden with them.
            where: {
              id: calculationId,
              simulation: { ownerId, deletedAt: null },
            },
            select: calculationSelect,
          },
        );
        return record ? this.toOutput(record) : null;
      },
      (cause) => new SimulationCalculationQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new SimulationCalculationNotFoundError(calculationId));
  }

  private toOutput(
    record: CalculationRecord,
  ): ListCalculationMonthlyBalancesOutput {
    const months = new Map<string, BalanceRecord[]>();
    for (const balance of record.balances) {
      const month = CalendarDate.fromUtcDate(balance.date)
        .value.toIsoString()
        .slice(0, 7);
      months.set(month, [...(months.get(month) ?? []), balance]);
    }
    return {
      items: [...months].map(([month, balances]) => {
        const last = balances[balances.length - 1];
        return {
          month,
          businessDays: balances.length,
          monthGrossEarnings: balances
            .reduce(
              (total, balance) => total.plus(balance.dailyGrossEarnings),
              new Prisma.Decimal(0),
            )
            .toFixed(),
          accumulatedGrossEarnings: last.accumulatedGrossEarnings.toFixed(),
          closingGrossBalance: last.grossBalance.toFixed(),
          days: balances.map((balance) => ({
            date: CalendarDate.fromUtcDate(balance.date).value.toIsoString(),
            grossBalance: balance.grossBalance.toFixed(),
            dailyGrossEarnings: balance.dailyGrossEarnings.toFixed(),
            accumulatedGrossEarnings:
              balance.accumulatedGrossEarnings.toFixed(),
          })),
        };
      }),
    };
  }
}
