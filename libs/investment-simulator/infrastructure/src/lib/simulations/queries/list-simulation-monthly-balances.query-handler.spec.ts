import { EAppErrorCode } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { ListSimulationMonthlyBalancesQueryHandler } from './list-simulation-monthly-balances.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

function balance(
  date: string,
  gross: string,
  daily: string,
  accumulated: string,
) {
  return {
    date: new Date(`${date}T00:00:00.000Z`),
    grossBalance: new Prisma.Decimal(gross),
    dailyGrossEarnings: new Prisma.Decimal(daily),
    accumulatedGrossEarnings: new Prisma.Decimal(accumulated),
  };
}

function setup(record: unknown) {
  const findFirst = jest.fn().mockResolvedValue(record);
  return {
    findFirst,
    handler: new ListSimulationMonthlyBalancesQueryHandler({
      client: { simulation: { findFirst } },
    } as unknown as PrismaService),
  };
}

describe('ListSimulationMonthlyBalancesQueryHandler', () => {
  it('groups the recorded days by month with exact totals', async () => {
    const { findFirst, handler } = setup({
      result: {
        balances: [
          balance('2026-01-30', '1000.1', '0.1', '0.1'),
          balance(
            '2026-02-02',
            '1000.300000000000000000000000000001',
            '0.200000000000000000000000000001',
            '0.300000000000000000000000000001',
          ),
          balance(
            '2026-02-03',
            '1000.6',
            '0.299999999999999999999999999999',
            '0.6',
          ),
        ],
      },
    });

    const result = await handler.execute({
      ownerId: 'owner',
      simulationId: 'simulation',
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'simulation', ownerId: 'owner', deletedAt: null },
      }),
    );
    expect(
      result.value.items.map(({ days: _days, ...month }) => month),
    ).toEqual([
      {
        month: '2026-01',
        businessDays: 1,
        monthGrossEarnings: '0.1',
        accumulatedGrossEarnings: '0.1',
        closingGrossBalance: '1000.1',
      },
      {
        month: '2026-02',
        businessDays: 2,
        monthGrossEarnings: '0.5',
        accumulatedGrossEarnings: '0.6',
        closingGrossBalance: '1000.6',
      },
    ]);
    expect(result.value.items[1].days.map(({ date }) => date)).toEqual([
      '2026-02-02',
      '2026-02-03',
    ]);
  });

  it('lists nothing for a simulation without a result', async () => {
    const { handler } = setup({ result: null });

    const result = await handler.execute({
      ownerId: 'owner',
      simulationId: 'simulation',
    });

    expect(result.value.items).toEqual([]);
  });

  it('reports a missing simulation and maps read failures', async () => {
    const { findFirst, handler } = setup(null);
    expect(
      (
        await handler.execute({
          ownerId: 'owner',
          simulationId: 'simulation',
        })
      ).error.code,
    ).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
    findFirst.mockRejectedValue(new Error('database'));
    expect(
      (
        await handler.execute({
          ownerId: 'owner',
          simulationId: 'simulation',
        })
      ).error.code,
    ).toBe(EAppErrorCode.SIMULATION_QUERY_FAILED);
  });
});
