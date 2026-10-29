import {
  ComparedSimulation,
  ESimulationCalculationStatus,
  ETitleType,
  SimulationResult,
} from '@investflow/investment-simulator-domain';
import {
  AppError,
  CalendarDate,
  EAppErrorCode,
  Money,
  Result,
} from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { ComparedSimulationReader } from '../compared-simulation-reader.port';
import { BuildSimulationComparisonQuery } from './build-simulation-comparison.query';
import { BuildSimulationComparisonUseCase } from './build-simulation-comparison.use-case';

const OWNER = 'owner';
const INPUT_FINGERPRINT = SimulationResult.inputFingerprintFor({
  simulationRevision: 1,
  offer: { titleType: ETitleType.CDB, termsRevision: 1 },
  curveValuesRevision: null,
});

function compared(id: string, netAnnualReturn: string): ComparedSimulation {
  return ComparedSimulation.create({
    id,
    calculationStatus: ESimulationCalculationStatus.CALCULATED,
    currentInputFingerprint: INPUT_FINGERPRINT,
    lastResult: {
      inputFingerprint: INPUT_FINGERPRINT,
      principal: Money.of('1000'),
      investmentDate: CalendarDate.of('2026-01-02'),
      maturityDate: CalendarDate.of('2027-01-04'),
      netFinalBalance: Money.of('1100'),
      netAnnualReturn: new Decimal(netAnnualReturn),
    },
  });
}

function setup() {
  const owned = new Map(
    [compared('a', '0.1'), compared('b', '0.12'), compared('c', '0.11')].map(
      (simulation) => [simulation.id, simulation],
    ),
  );
  const reader = {
    findOwned: jest.fn(async (ownerId: string, ids: readonly string[]) =>
      Result.ok(
        new Map(
          ownerId === OWNER
            ? ids.flatMap((id) => {
                const simulation = owned.get(id);
                return simulation ? [[id, simulation] as const] : [];
              })
            : [],
        ),
      ),
    ),
  } satisfies ComparedSimulationReader;
  return { reader, useCase: new BuildSimulationComparisonUseCase(reader) };
}

describe('BuildSimulationComparisonUseCase', () => {
  it('compares the simulations in the requested order', async () => {
    const { useCase, reader } = setup();

    const comparison = (
      await useCase.execute(
        BuildSimulationComparisonQuery.of(OWNER, ['c', 'a', 'b']),
      )
    ).value;

    expect(reader.findOwned).toHaveBeenCalledWith(OWNER, ['c', 'a', 'b']);
    expect(comparison?.simulations.map(({ id }) => id)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(comparison?.standingOf('b')?.isLeader).toBe(true);
    expect(comparison?.isSettled).toBe(true);
  });

  it.each([
    ['a missing or deleted simulation', OWNER, ['a', 'gone'], 'gone'],
    ["another owner's simulations", 'other', ['a', 'b'], 'a'],
  ])('reports %s as not found', async (_, ownerId, ids, missingId) => {
    const { useCase } = setup();

    const result = await useCase.execute(
      BuildSimulationComparisonQuery.of(ownerId, ids),
    );

    expect(result.error.code).toBe(EAppErrorCode.SIMULATION_NOT_FOUND);
    expect(result.error.metadata).toEqual({ simulationId: missingId });
  });

  it('passes a failed read on', async () => {
    const { useCase, reader } = setup();
    const failure = Result.err(
      new AppError('Não foi possível carregar a comparação.', {
        code: EAppErrorCode.SIMULATION_COMPARISON_QUERY_FAILED,
        kind: 'infrastructure',
      }),
    );
    reader.findOwned.mockResolvedValueOnce(failure);

    expect(
      await useCase.execute(
        BuildSimulationComparisonQuery.of(OWNER, ['a', 'b']),
      ),
    ).toBe(failure);
  });
});
