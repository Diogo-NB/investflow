import { ETitleType } from '../../offers/title-type.enum';
import { ESimulationCalculationStatus } from '../simulation-calculation.vo';
import { SimulationResult } from '../simulation-result.vo';
import {
  SimulationResultValidity,
  SimulationResultValidityProps,
} from '../simulation-result-validity.vo';

const fingerprint = (simulationRevision: number) =>
  SimulationResult.inputFingerprintFor({
    simulationRevision,
    offer: { titleType: ETitleType.CDB, termsRevision: 1 },
    curveValuesRevision: null,
  });

// Calculated from its current premises unless overridden.
const validity = (overrides: Partial<SimulationResultValidityProps> = {}) =>
  SimulationResultValidity.create({
    calculationStatus: ESimulationCalculationStatus.CALCULATED,
    currentInputFingerprint: fingerprint(2),
    resultInputFingerprint: fingerprint(2),
    ...overrides,
  });

describe('SimulationResultValidity', () => {
  it('is settled when calculated from the current premises', () => {
    expect(validity().isResultCurrent).toBe(true);
    expect(validity().isSettled).toBe(true);
  });

  it('has a stale result once the premises changed', () => {
    const stale = validity({ currentInputFingerprint: fingerprint(3) });

    expect(stale.isResultCurrent).toBe(false);
    expect(stale.isSettled).toBe(false);
  });

  it.each([
    ESimulationCalculationStatus.PENDING,
    ESimulationCalculationStatus.INVALID,
    ESimulationCalculationStatus.FAILED,
  ])('is not settled while %s, even with a current result', (status) => {
    const queued = validity({ calculationStatus: status });

    expect(queued.isResultCurrent).toBe(true);
    expect(queued.isSettled).toBe(false);
  });

  it('has no current result without a result', () => {
    const none = validity({ resultInputFingerprint: null });

    expect(none.isResultCurrent).toBe(false);
    expect(none.isSettled).toBe(false);
  });

  it('compares by value', () => {
    expect(validity().equals(validity())).toBe(true);
    expect(
      validity().equals(
        validity({ calculationStatus: ESimulationCalculationStatus.PENDING }),
      ),
    ).toBe(false);
    expect(
      validity().equals(validity({ currentInputFingerprint: fingerprint(3) })),
    ).toBe(false);
    expect(validity().equals(validity({ resultInputFingerprint: null }))).toBe(
      false,
    );
    expect(
      validity({ resultInputFingerprint: null }).equals(
        validity({ resultInputFingerprint: null }),
      ),
    ).toBe(true);
  });
});
