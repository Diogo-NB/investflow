import { Clock } from '@investflow/shared-application';
import { CalendarDate, EAppErrorCode } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { GetSimulationComparisonQueryHandler } from './get-simulation-comparison.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function result(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    simulationRevision: 2,
    offerTermsRevision: 3,
    curveValuesRevision: null,
    methodologyVersion: 'cdb-252-v1',
    calculatedAt: new Date('2026-10-10T12:00:00.000Z'),
    investmentDate: date('2026-01-02'),
    maturityDate: date('2028-01-03'),
    principal: new Prisma.Decimal('10000'),
    grossBalance: new Prisma.Decimal('12544'),
    grossEarnings: new Prisma.Decimal('2544'),
    iof: new Prisma.Decimal('0'),
    incomeTax: new Prisma.Decimal('381.6'),
    totalTaxes: new Prisma.Decimal('381.6'),
    netBalance: new Prisma.Decimal('12162.4'),
    holdingPeriodCalendarDays: 731,
    taxableEarnings: new Prisma.Decimal('2544'),
    incomeTaxBase: new Prisma.Decimal('2544'),
    iofRate: null,
    incomeTaxRate: new Prisma.Decimal('0.15'),
    businessDays: 504,
    netAnnualReturn: new Prisma.Decimal('0.1028'),
    netMonthlyReturn: new Prisma.Decimal('0.0082'),
    netPeriodReturn: new Prisma.Decimal('0.2162'),
    grossAnnualReturn: new Prisma.Decimal('0.12'),
    grossMonthlyReturn: new Prisma.Decimal('0.0095'),
    grossPeriodReturn: new Prisma.Decimal('0.2544'),
    ...overrides,
  };
}

function simulation(
  id: string,
  overrides: {
    result?: unknown;
    status?: string;
    revision?: number;
  } = {},
) {
  return {
    id,
    revision: overrides.revision ?? 2,
    principal: new Prisma.Decimal('10000'),
    investmentDate: date('2026-01-02'),
    curveId: null,
    offer: {
      id: `offer-${id}`,
      titleType: 'CDB',
      name: `CDB ${id}`,
      issuerName: null,
      maturityDate: date('2028-01-03'),
      redemptionType: 'AT_MATURITY',
      remunerationType: 'PREFIXED',
      rateValue: new Prisma.Decimal('0.12'),
      ownerId: 'owner-id',
      revision: 3,
      termsRevision: 3,
      deletedAt: null,
    },
    curve: null,
    calculation: {
      status: overrides.status ?? 'CALCULATED',
      changedAt: new Date('2026-10-10T12:00:00.000Z'),
      causeKind: 'CREATED',
      causeRefId: null,
      reasonCode: null,
      reasonMetadata: null,
    },
    result: overrides.result === undefined ? result() : overrides.result,
  };
}

function setup(records: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(records);
  const today = jest.fn(() => CalendarDate.of('2026-10-16'));
  const prisma = {
    client: { simulation: { findMany } },
  } as unknown as PrismaService;
  const handler = new GetSimulationComparisonQueryHandler(prisma, {
    today,
  } as unknown as Clock);
  return {
    findMany,
    today,
    execute: (ids: string[]) => handler.execute({ ownerId: 'owner-id', ids }),
  };
}

describe('GetSimulationComparisonQueryHandler', () => {
  it('reads the owner simulations in the requested order', async () => {
    const { execute, findMany, today } = setup([
      simulation('a'),
      simulation('b'),
    ]);

    const output = await execute(['b', 'a']);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['b', 'a'] }, ownerId: 'owner-id', deletedAt: null },
      }),
    );
    expect(today).toHaveBeenCalledTimes(1);
    expect(
      output.value.simulations.map(({ simulation }) => simulation.id),
    ).toEqual(['b', 'a']);
  });

  it('answers not found when any simulation is missing or foreign', async () => {
    const output = await setup([simulation('a')]).execute(['a', 'b']);

    expect(output.error).toMatchObject({
      code: EAppErrorCode.SIMULATION_NOT_FOUND,
    });
  });

  it('ranks by net annual return and compares equal investments in money', async () => {
    const output = await setup([
      simulation('a'),
      simulation('b', {
        result: result({
          netAnnualReturn: new Prisma.Decimal('0.1061'),
          netBalance: new Prisma.Decimal('12230'),
        }),
      }),
      simulation('c', { result: null, status: 'PENDING' }),
    ]).execute(['a', 'b', 'c']);

    const comparison = output.value;
    expect(comparison).toMatchObject({
      settled: false,
      amountsComparable: true,
    });
    expect(comparison.simulations.map(({ standing }) => standing)).toEqual([
      {
        position: 2,
        leader: false,
        netAnnualReturnGap: '0.0033',
        netBalanceGap: '67.6',
      },
      {
        position: 1,
        leader: true,
        netAnnualReturnGap: '0',
        netBalanceGap: '0',
      },
      null,
    ]);
  });

  it('ranks outdated results without settling the comparison', async () => {
    const output = await setup([
      simulation('a', {
        revision: 3,
        result: result({ netAnnualReturn: new Prisma.Decimal('0.2') }),
      }),
      simulation('b'),
    ]).execute(['a', 'b']);

    const comparison = output.value;
    expect(comparison.settled).toBe(false);
    expect(comparison.simulations[0].result?.outdated).toBe(true);
    expect(comparison.simulations[0].standing).toMatchObject({
      position: 1,
      leader: true,
    });
  });

  it('settles when every result is calculated and current', async () => {
    const output = await setup([simulation('a'), simulation('b')]).execute([
      'a',
      'b',
    ]);

    expect(output.value.settled).toBe(true);
  });

  it('wraps persistence failures', async () => {
    const { execute, findMany } = setup([]);
    findMany.mockRejectedValue(new Error('connection lost'));

    expect((await execute(['a', 'b'])).error).toMatchObject({
      code: EAppErrorCode.SIMULATION_COMPARISON_QUERY_FAILED,
    });
  });
});
