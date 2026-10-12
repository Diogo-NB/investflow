import { Injectable } from '@nestjs/common';
import { SimulationNotFoundError } from '@investflow/investment-simulator-application';
import { QueryHandler } from '@investflow/shared-application';
import { CalendarDate, Result } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { SimulationQueryError } from './simulation-query.error';

export interface ListSimulationMonthlyBalancesQuery {
  readonly ownerId: string;
  readonly simulationId: string;
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

export interface ListSimulationMonthlyBalancesOutput {
  readonly items: readonly MonthlyBalanceItem[];
}

const simulationSelect = {
  result: {
    select: {
      balances: {
        select: {
          date: true,
          grossBalance: true,
          dailyGrossEarnings: true,
          accumulatedGrossEarnings: true,
        },
        orderBy: { date: 'asc' },
      },
    },
  },
} satisfies Prisma.SimulationSelect;

type SimulationRecord = Prisma.SimulationGetPayload<{
  select: typeof simulationSelect;
}>;
type BalanceRecord = NonNullable<
  SimulationRecord['result']
>['balances'][number];

@Injectable()
export class ListSimulationMonthlyBalancesQueryHandler
  implements
    QueryHandler<
      ListSimulationMonthlyBalancesQuery,
      ListSimulationMonthlyBalancesOutput
    >
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    ownerId,
    simulationId,
  }: ListSimulationMonthlyBalancesQuery): Promise<
    Result<
      ListSimulationMonthlyBalancesOutput,
      SimulationNotFoundError | SimulationQueryError
    >
  > {
    const result = await Result.fromPromise(
      async () => {
        const record = await this.prisma.client.simulation.findFirst({
          where: { id: simulationId, ownerId, deletedAt: null },
          select: simulationSelect,
        });
        return record ? this.toOutput(record) : null;
      },
      (cause) => new SimulationQueryError(cause),
    );
    if (result.isErr()) return result;
    return result.value
      ? Result.ok(result.value)
      : Result.err(new SimulationNotFoundError(simulationId));
  }

  private toOutput(
    record: SimulationRecord,
  ): ListSimulationMonthlyBalancesOutput {
    const months = new Map<string, BalanceRecord[]>();
    for (const balance of record.result?.balances ?? []) {
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
