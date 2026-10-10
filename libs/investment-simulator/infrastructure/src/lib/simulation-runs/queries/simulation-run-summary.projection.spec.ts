import { METHODOLOGY_VERSION } from '@investflow/investment-simulator-domain';
import { Prisma } from '@prisma/client';
import { toRunSummary } from './simulation-run-summary.projection';

const application = {
  offerSnapshotId: 'snapshot-id',
  indexCurveId: 'curve-id',
  principal: new Prisma.Decimal('1000.50'),
  investmentDate: new Date('2026-01-02T00:00:00.000Z'),
};

function run(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...application,
    id: 'run-id',
    calculatedAt: new Date('2026-10-10T12:00:00.000Z'),
    methodologyVersion: METHODOLOGY_VERSION,
    grossBalance: new Prisma.Decimal('1001.000000000000000001'),
    grossEarnings: new Prisma.Decimal('0.500000000000000001'),
    iof: new Prisma.Decimal('0'),
    incomeTax: new Prisma.Decimal('0.1125'),
    totalTaxes: new Prisma.Decimal('0.1125'),
    netBalance: new Prisma.Decimal('1000.887500000000000001'),
    ...overrides,
  } as Parameters<typeof toRunSummary>[0];
}

describe('toRunSummary', () => {
  it('renders plain read data with exact decimal strings', () => {
    expect(toRunSummary(run(), application)).toEqual({
      id: 'run-id',
      calculatedAt: '2026-10-10T12:00:00.000Z',
      methodologyVersion: METHODOLOGY_VERSION,
      outdated: false,
      inputs: {
        offerSnapshotId: 'snapshot-id',
        indexCurveId: 'curve-id',
        principal: '1000.5',
        investmentDate: '2026-01-02',
      },
      maturitySummary: {
        principal: '1000.5',
        grossBalance: '1001.000000000000000001',
        grossEarnings: '0.500000000000000001',
        iof: '0',
        incomeTax: '0.1125',
        totalTaxes: '0.1125',
        netBalance: '1000.887500000000000001',
      },
    });
  });

  it.each([
    ['offer snapshot', { offerSnapshotId: 'other-snapshot' }],
    ['index curve', { indexCurveId: null }],
    ['principal', { principal: new Prisma.Decimal('2000') }],
    ['investment date', { investmentDate: new Date('2026-01-05T00:00:00Z') }],
    ['methodology', { methodologyVersion: 'cdb-252-v0' }],
  ])('flags a run whose %s no longer matches', (_field, changed) => {
    expect(toRunSummary(run(changed), application).outdated).toBe(true);
  });

  it('compares principals by value, not by representation', () => {
    expect(
      toRunSummary(
        run({ principal: new Prisma.Decimal('1000.500') }),
        application,
      ).outdated,
    ).toBe(false);
  });
});
