import { EAppErrorCode } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { GetSimulationWorkspaceQueryHandler } from './get-simulation-workspace.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function result(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    simulationRevision: 2,
    offerRevision: 3,
    curveRevision: 4,
    methodologyVersion: 'cdb-252-v1',
    calculatedAt: new Date('2026-10-10T12:00:00.000Z'),
    investmentDate: date('2026-01-02'),
    maturityDate: date('2026-03-02'),
    principal: new Prisma.Decimal('1000.50'),
    grossBalance: new Prisma.Decimal('1001.000000000000000001'),
    grossEarnings: new Prisma.Decimal('0.500000000000000001'),
    iof: new Prisma.Decimal('0'),
    incomeTax: new Prisma.Decimal('0.1125'),
    totalTaxes: new Prisma.Decimal('0.1125'),
    netBalance: new Prisma.Decimal('1000.887500000000000001'),
    holdingPeriodCalendarDays: 59,
    taxableEarnings: new Prisma.Decimal('0.500000000000000001'),
    incomeTaxBase: new Prisma.Decimal('0.500000000000000001'),
    iofRate: null,
    incomeTaxRate: new Prisma.Decimal('0.225'),
    _count: { balances: 40 },
    ...overrides,
  };
}

function setup(record: unknown) {
  const findFirst = jest.fn().mockResolvedValue(record);
  const prisma = {
    client: { simulation: { findFirst } },
  } as unknown as PrismaService;
  const handler = new GetSimulationWorkspaceQueryHandler(prisma);
  return (simulationId = 'simulation-id') =>
    handler.execute({ ownerId: 'owner-id', simulationId });
}

function workspace(
  overrides: {
    result?: unknown;
    offer?: Partial<Record<string, unknown>>;
    curve?: Partial<Record<string, unknown>>;
    calculation?: Partial<Record<string, unknown>>;
    revision?: number;
  } = {},
) {
  return {
    id: 'simulation-id',
    revision: overrides.revision ?? 2,
    principal: new Prisma.Decimal('1000.50'),
    investmentDate: date('2026-01-02'),
    curveId: 'curve-id',
    offer: {
      id: 'offer-id',
      titleType: 'CDB',
      name: 'CDB 110% CDI',
      issuerName: null,
      maturityDate: date('2026-03-02'),
      redemptionType: 'AT_MATURITY',
      remunerationType: 'CDI_PERCENTAGE',
      rateValue: new Prisma.Decimal('1.10'),
      ownerId: 'owner-id',
      revision: 3,
      deletedAt: null,
      ...overrides.offer,
    },
    curve: {
      id: 'curve-id',
      name: 'CDI base',
      revision: 4,
      deletedAt: null,
      ...overrides.curve,
    },
    calculation: {
      status: 'CALCULATED',
      changedAt: new Date('2026-10-10T12:00:00.000Z'),
      causeKind: 'SIMULATION_EDITED',
      causeRefId: null,
      reasonCode: null,
      reasonMetadata: null,
      ...overrides.calculation,
    },
    result: overrides.result === undefined ? result() : overrides.result,
  };
}

describe('GetSimulationWorkspaceQueryHandler', () => {
  it('reports why a calculation cannot run with its details', async () => {
    const output = await setup(
      workspace({
        calculation: {
          status: 'INVALID',
          causeKind: 'CREATED',
          reasonCode: 'INVESTMENT_CURVE_COVERAGE_MISSING',
          reasonMetadata: {
            missingRanges: [{ start: '2026-02-02', end: '2026-02-27' }],
          },
        },
      }),
    )();

    expect(output.value.calculation).toEqual({
      status: 'INVALID',
      changedAt: '2026-10-10T12:00:00.000Z',
      cause: { kind: 'CREATED', refId: null },
      reason: {
        code: 'INVESTMENT_CURVE_COVERAGE_MISSING',
        metadata: {
          missingRanges: [{ start: '2026-02-02', end: '2026-02-27' }],
        },
      },
    });
  });

  it('renders the simulation, its premises and result as plain read data', async () => {
    const output = await setup(workspace())();

    expect(output.value.simulation).toEqual({
      id: 'simulation-id',
      revision: 2,
      investment: {
        principal: '1000.5',
        investmentDate: '2026-01-02',
        curveId: 'curve-id',
      },
    });
    expect(output.value.offer).toEqual({
      id: 'offer-id',
      titleType: 'CDB',
      name: 'CDB 110% CDI',
      issuerName: null,
      maturityDate: '2026-03-02',
      redemptionTerms: { kind: 'AT_MATURITY' },
      remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
      origin: 'OWN',
      revision: 3,
      deleted: false,
    });
    expect(output.value.curve).toEqual({
      id: 'curve-id',
      name: 'CDI base',
      deleted: false,
    });
    expect(output.value.calculation).toEqual({
      status: 'CALCULATED',
      changedAt: '2026-10-10T12:00:00.000Z',
      cause: { kind: 'SIMULATION_EDITED', refId: null },
      reason: null,
    });
    expect(output.value.result).toEqual({
      calculatedAt: '2026-10-10T12:00:00.000Z',
      investmentDate: '2026-01-02',
      maturityDate: '2026-03-02',
      methodologyVersion: 'cdb-252-v1',
      outdated: false,
      businessDays: 40,
      maturitySummary: {
        principal: '1000.5',
        grossBalance: '1001.000000000000000001',
        grossEarnings: '0.500000000000000001',
        iof: '0',
        incomeTax: '0.1125',
        totalTaxes: '0.1125',
        netBalance: '1000.887500000000000001',
      },
      taxes: {
        holdingPeriodCalendarDays: 59,
        iof: {
          base: '0.500000000000000001',
          rate: null,
          amount: '0',
          formula: 'Isento: prazo de 30 dias ou mais',
        },
        incomeTax: {
          base: '0.500000000000000001',
          rate: '0.225',
          amount: '0.1125',
          formula: 'R$\u00a00,50 × 22,5% = R$\u00a00,11',
        },
      },
    });
  });

  it.each([
    ['the simulation changed', workspace({ revision: 3 })],
    ['the offer changed', workspace({ offer: { revision: 4 } })],
    [
      'the offer was deleted',
      workspace({ offer: { revision: 4, deletedAt: new Date() } }),
    ],
    ['the curve changed', workspace({ curve: { revision: 5 } })],
    [
      'the methodology changed',
      workspace({ result: result({ methodologyVersion: 'cdb-252-v0' }) }),
    ],
  ])('flags the result as outdated when %s', async (_, record) => {
    const output = await setup(record)();

    expect(output.value.result?.outdated).toBe(true);
  });

  it('reports deleted premises and a missing result', async () => {
    const output = await setup(
      workspace({
        result: null,
        offer: { deletedAt: new Date() },
        curve: { deletedAt: new Date() },
      }),
    )();

    expect(output.value.offer.deleted).toBe(true);
    expect(output.value.curve?.deleted).toBe(true);
    expect(output.value.result).toBeNull();
  });

  it('writes a charged IOF with its recorded base, rate and amount', async () => {
    const output = await setup(
      workspace({
        result: result({
          taxableEarnings: new Prisma.Decimal('100'),
          iofRate: new Prisma.Decimal('0.66'),
          iof: new Prisma.Decimal('66'),
        }),
      }),
    )();

    expect(output.value.result?.taxes.iof.formula).toBe(
      'R$\u00a0100,00 × 66% = R$\u00a066,00',
    );
  });

  it('explains an LCI income tax exemption against its own methodology', async () => {
    const output = await setup(
      workspace({
        offer: { titleType: 'LCI' },
        result: result({
          methodologyVersion: 'lci-252-v1',
          incomeTaxRate: null,
          incomeTax: new Prisma.Decimal('0'),
        }),
      }),
    )();

    const summary = output.value.result;
    expect(summary?.outdated).toBe(false);
    expect(summary?.taxes.incomeTax).toMatchObject({
      rate: null,
      amount: '0',
      formula: 'Isento: LCI e LCA de pessoa física',
    });
  });

  it('reports a missing simulation', async () => {
    const result = await setup(null)('gone');

    expect(result.error.code).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
  });
});
