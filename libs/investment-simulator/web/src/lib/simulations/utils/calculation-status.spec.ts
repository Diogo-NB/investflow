import { workspace } from '../../testing/simulator-fixtures';
import type { SimulationCalculation } from '../models/simulation.types';
import {
  calculationStatusLabel,
  describeCause,
  describeReason,
} from './calculation-status';

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

  it('names the changed curve or offer when the simulation uses it', () => {
    expect(
      describeCause(
        calculation({ kind: 'CURVE_CHANGED', refId: 'cdi' }),
        workspace,
      ),
    ).toBe('a curva CDI Local foi alterada');
    expect(
      describeCause(
        calculation({ kind: 'OFFER_DELETED', refId: 'other' }),
        workspace,
      ),
    ).toBe('a oferta foi excluída');
    expect(
      describeCause(
        calculation({ kind: 'SIMULATION_EDITED', refId: null }),
        workspace,
      ),
    ).toBe('simulação alterada');
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

  it('asks for another premise when one is gone', () => {
    expect(describeReason({ code: 'OFFER_NOT_FOUND', metadata: {} })).toBe(
      'Sem oferta, escolha outra.',
    );
    expect(describeReason({ code: 'CURVE_NOT_FOUND', metadata: {} })).toBe(
      'Sem curva, escolha outra.',
    );
  });
});
