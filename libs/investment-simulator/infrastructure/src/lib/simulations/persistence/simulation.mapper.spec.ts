import {
  ESimulationCalculationCauseKind,
  ESimulationCalculationStatus,
} from '@investflow/investment-simulator-domain';
import { EAppErrorCode } from '@investflow/shared-domain';
import { Prisma } from '@prisma/client';
import { SimulationMapper, SimulationRecord } from './simulation.mapper';

const id = 'a1d7a2a4-7c39-4b8e-9a8f-0d6c1f0b2f11';
const decimal = (value: string) => new Prisma.Decimal(value);

const calculation: NonNullable<SimulationRecord['calculation']> = {
  simulationId: id,
  status: 'INVALID',
  changedAt: new Date('2026-10-11T12:00:00.000Z'),
  causeKind: 'CURVE_CHANGED',
  causeRefId: 'c51b8f16-2b90-4d24-a2f9-5923eb77c16c',
  causeActorId: 'owner-id',
  simulationRevision: 3,
  offerTermsRevision: 4,
  curveValuesRevision: 6,
  reasonCode: 'INVESTMENT_CURVE_COVERAGE_MISSING',
  reasonMetadata: {
    missingRanges: [{ start: '2026-01-05', end: '2026-01-05' }],
  },
};

const record: SimulationRecord = {
  id,
  ownerId: 'owner-id',
  offerId: 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c',
  curveId: 'c51b8f16-2b90-4d24-a2f9-5923eb77c16c',
  principal: decimal('1000.123456789012345678901234567891'),
  investmentDate: new Date('2026-01-02T00:00:00.000Z'),
  revision: 3,
  deletedAt: new Date('2026-10-11T12:00:00.000Z'),
  createdAt: new Date('2026-10-10T12:00:00.000Z'),
  updatedAt: new Date('2026-10-10T12:00:00.000Z'),
  calculation,
  result: {
    simulationId: id,
    simulationRevision: 2,
    offerTermsRevision: 4,
    curveValuesRevision: 5,
    methodologyVersion: 'cdb-252-v1',
    calculatedAt: new Date('2026-10-10T12:00:00.000Z'),
    investmentDate: new Date('2026-01-02T00:00:00.000Z'),
    maturityDate: new Date('2026-01-05T00:00:00.000Z'),
    principal: decimal('1000.123456789012345678901234567891'),
    grossBalance: decimal('1010'),
    grossEarnings: decimal('9.876543210987654321098765432109'),
    iof: decimal('0'),
    incomeTax: decimal('2.2'),
    totalTaxes: decimal('2.2'),
    netBalance: decimal('1007.8'),
    holdingPeriodCalendarDays: 3,
    taxableEarnings: decimal('9.876543210987654321098765432109'),
    incomeTaxBase: decimal('9.876543210987654321098765432109'),
    iofRate: null,
    incomeTaxRate: decimal('0.225'),
    businessDays: 1,
    // A read model the domain derives again; deliberately wrong here.
    netAnnualReturn: decimal('9'),
    netMonthlyReturn: decimal('9'),
    netPeriodReturn: decimal('9'),
    grossAnnualReturn: decimal('9'),
    grossMonthlyReturn: decimal('9'),
    grossPeriodReturn: decimal('9'),
    balances: [
      {
        simulationId: id,
        date: new Date('2026-01-05T00:00:00.000Z'),
        grossBalance: decimal('1010'),
        dailyGrossEarnings: decimal('9.876543210987654321098765432109'),
        accumulatedGrossEarnings: decimal('9.876543210987654321098765432109'),
      },
    ],
  },
};

describe('SimulationMapper', () => {
  it('round-trips the simulation, its result and balances precisely', () => {
    const simulation = SimulationMapper.toDomain(record);

    expect(simulation.revision).toBe(3);
    expect(simulation.result?.inputs).toEqual({
      simulationRevision: 2,
      offerTermsRevision: 4,
      curveValuesRevision: 5,
      methodologyVersion: 'cdb-252-v1',
    });
    const data = SimulationMapper.toPersistence(simulation);
    expect(data.simulation).toEqual({
      id,
      ownerId: 'owner-id',
      offerId: record.offerId,
      curveId: record.curveId,
      principal: '1000.123456789012345678901234567891',
      investmentDate: record.investmentDate,
      revision: 3,
      deletedAt: record.deletedAt,
    });
    expect(data.calculation).toEqual(calculation);
    expect(data.result).toMatchObject({
      simulationId: id,
      offerTermsRevision: 4,
      investmentDate: new Date('2026-01-02T00:00:00.000Z'),
      maturityDate: new Date('2026-01-05T00:00:00.000Z'),
      // Derived from the balances at decimal.js precision, not read back.
      grossEarnings: '9.8765432109876543211',
      iofRate: null,
      incomeTaxRate: '0.225',
      businessDays: 1,
      holdingPeriodCalendarDays: 3,
      netBalance: '1007.8',
    });
    const { gross, net } = simulation.result!.projection;
    expect(data.result).toMatchObject({
      grossPeriodReturn: gross.rateOfReturn.forPeriod.toFixed(),
      grossAnnualReturn: gross.rateOfReturn.annual.toFixed(),
      netAnnualReturn: net.rateOfReturn.annual.toFixed(),
      netMonthlyReturn: net.rateOfReturn.monthly.toFixed(),
    });

    expect(data.balances).toEqual([
      {
        simulationId: id,
        date: new Date('2026-01-05T00:00:00.000Z'),
        grossBalance: '1010',
        dailyGrossEarnings: '9.876543210987654321098765432109',
        accumulatedGrossEarnings: '9.876543210987654321098765432109',
      },
    ]);
  });

  it('maps the calculation state with its cause and reason', () => {
    const { calculation } = SimulationMapper.toDomain(record);

    expect(calculation.status).toBe(ESimulationCalculationStatus.INVALID);
    expect(calculation.changedAt.toISOString()).toBe(
      '2026-10-11T12:00:00.000Z',
    );
    expect(calculation.cause).toEqual({
      kind: ESimulationCalculationCauseKind.CURVE_CHANGED,
      refId: record.curveId,
      actorId: 'owner-id',
    });
    expect(calculation.inputs).toEqual({
      simulationRevision: 3,
      offerTermsRevision: 4,
      curveValuesRevision: 6,
    });
    expect(calculation.reason).toEqual({
      code: EAppErrorCode.INVESTMENT_CURVE_COVERAGE_MISSING,
      metadata: { missingRanges: [{ start: '2026-01-05', end: '2026-01-05' }] },
    });
  });

  it('stores no reason outside INVALID', () => {
    const simulation = SimulationMapper.toDomain({
      ...record,
      calculation: {
        ...calculation,
        status: 'PENDING',
        reasonCode: null,
        reasonMetadata: null,
      },
    });

    expect(simulation.calculation.reason).toBeNull();
    expect(
      SimulationMapper.toPersistence(simulation).calculation,
    ).toMatchObject({ reasonCode: null, reasonMetadata: Prisma.DbNull });
  });

  it('maps a simulation without a result', () => {
    const simulation = SimulationMapper.toDomain({ ...record, result: null });

    expect(simulation.result).toBeNull();
    expect(SimulationMapper.toPersistence(simulation)).toMatchObject({
      result: null,
      balances: [],
    });
  });
});
