import { EAppErrorCode } from '@investflow/shared-domain';
import { PrismaService } from '@investflow/shared-infrastructure';
import { Prisma } from '@prisma/client';
import { GetSimulationWorkspaceQueryHandler } from './get-simulation-workspace.query-handler';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function calculation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'calculation-id',
    calculatedAt: new Date('2026-10-10T12:00:00.000Z'),
    methodologyVersion: 'cdb-252-v1',
    principal: new Prisma.Decimal('1000.50'),
    investmentDate: date('2026-01-02'),
    indexCurveId: 'curve-id',
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

function workspace(calculations: unknown[], issuer: unknown = null) {
  return {
    id: 'simulation-id',
    sourceOfferId: null,
    titleType: 'CDB',
    issuer,
    maturityDate: date('2026-03-02'),
    redemptionType: 'AT_MATURITY',
    remunerationType: 'CDI_PERCENTAGE',
    rateValue: new Prisma.Decimal('1.10'),
    calculations,
  };
}

describe('GetSimulationWorkspaceQueryHandler', () => {
  it('renders the simulation and its calculations as plain read data', async () => {
    const result = await setup(workspace([calculation()]))();

    expect(result.value.simulation).toEqual({
      id: 'simulation-id',
      fromCatalogOffer: false,
      terms: {
        titleType: 'CDB',
        issuer: null,
        maturityDate: '2026-03-02',
        redemptionTerms: { kind: 'AT_MATURITY' },
        remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
      },
    });
    expect(result.value.calculations).toEqual([
      {
        id: 'calculation-id',
        calculatedAt: '2026-10-10T12:00:00.000Z',
        methodologyVersion: 'cdb-252-v1',
        outdated: false,
        investment: {
          principal: '1000.5',
          investmentDate: '2026-01-02',
          indexCurveId: 'curve-id',
        },
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
      },
    ]);
  });

  it('names the issuer when the terms have one', async () => {
    const result = await setup(
      workspace([calculation()], { id: 'issuer-id', name: 'Banco Local' }),
    )();

    expect(result.value.simulation.terms.issuer).toEqual({
      id: 'issuer-id',
      name: 'Banco Local',
    });
  });

  it('flags calculations made under another methodology', async () => {
    const result = await setup(
      workspace([calculation({ methodologyVersion: 'cdb-252-v0' })]),
    )();

    expect(result.value.calculations[0].outdated).toBe(true);
  });

  it('writes a charged IOF with its recorded base, rate and amount', async () => {
    const result = await setup(
      workspace([
        calculation({
          taxableEarnings: new Prisma.Decimal('100'),
          iofRate: new Prisma.Decimal('0.66'),
          iof: new Prisma.Decimal('66'),
        }),
      ]),
    )();

    expect(result.value.calculations[0].taxes.iof.formula).toBe(
      'R$\u00a0100,00 × 66% = R$\u00a066,00',
    );
  });

  it('explains an LCI income tax exemption against its own methodology', async () => {
    const result = await setup({
      ...workspace([
        calculation({
          methodologyVersion: 'lci-252-v1',
          incomeTaxRate: null,
          incomeTax: new Prisma.Decimal('0'),
        }),
      ]),
      titleType: 'LCI',
    })();

    const [summary] = result.value.calculations;
    expect(summary.outdated).toBe(false);
    expect(summary.taxes.incomeTax).toMatchObject({
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
