import { workspace } from '../../../testing/simulator-fixtures';
import type { SimulationCalculation } from '../../models/simulation.types';
import {
  calculationStatusLabel,
  describeCause,
  describeReason,
} from '../calculation-status';

function calculation(
  cause: SimulationCalculation['cause'],
): SimulationCalculation {
  return { ...workspace.calculation, status: 'PENDING', cause };
}

describe('calculation status', () => {
  it('tags every status except an up-to-date result', () => {
    expect(calculationStatusLabel('PENDING')).toBe('Calculando');
    expect(calculationStatusLabel('INVALID')).toBe('Requer ação');
    expect(calculationStatusLabel('FAILED')).toBe('Falha técnica');
    expect(calculationStatusLabel('CALCULATED')).toBeNull();
  });

  it('says why the calculation was last queued', () => {
    expect(describeCause(calculation({ kind: 'CREATED' }))).toBe(
      'simulação criada',
    );
    expect(describeCause(calculation({ kind: 'SIMULATION_EDITED' }))).toBe(
      'simulação alterada',
    );
    expect(describeCause(calculation({ kind: 'RETRY_REQUESTED' }))).toBe(
      'nova tentativa solicitada',
    );
  });

  it('phrases the first coverage gap and counts the others', () => {
    const gap = { start: '2029-01-02', end: '2029-12-28' };

    expect(
      describeReason({
        code: 'INVESTMENT_CURVE_COVERAGE_MISSING',
        metadata: { missingRanges: [gap, gap, gap] },
      }),
    ).toBe(
      'A curva não tem valores entre 02/01/2029 e 28/12/2029 e em mais 2 períodos. Escolha outra curva ou ajuste o período.',
    );
    expect(
      describeReason({
        code: 'INVESTMENT_CURVE_COVERAGE_MISSING',
        metadata: { missingRanges: [gap] },
      }),
    ).toBe(
      'A curva não tem valores entre 02/01/2029 e 28/12/2029. Escolha outra curva ou ajuste o período.',
    );
  });

  it("names the index a curve must have once the offer's index changed", () => {
    expect(
      describeReason({
        code: 'INVESTMENT_CURVE_INCOMPATIBLE',
        metadata: { expectedIndex: 'SELIC', actualIndex: 'CDI' },
      }),
    ).toBe(
      'A curva não é do SELIC, o índice da oferta. Escolha uma curva do SELIC e salve.',
    );
    expect(
      describeReason({
        code: 'INVESTMENT_CURVE_INCOMPATIBLE',
        metadata: { expectedIndex: null, actualIndex: 'CDI' },
      }),
    ).toBe(
      'A oferta é prefixada e não usa curva. Salve novamente para removê-la.',
    );
    expect(
      describeReason({
        code: 'INVESTMENT_CURVE_REQUIRED',
        metadata: { index: 'CDI' },
      }),
    ).toBe('A oferta usa o CDI. Escolha uma curva do CDI e salve.');
  });

  it('asks for another premise when one is gone', () => {
    expect(describeReason({ code: 'OFFER_NOT_FOUND', metadata: {} })).toBe(
      'Sem oferta, escolha outra.',
    );
    expect(describeReason({ code: 'CURVE_NOT_FOUND', metadata: {} })).toBe(
      'Sem curva, escolha outra.',
    );
  });
});
