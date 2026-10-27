import { ETitleType } from '../../offers/title-type.enum';
import { SimulationResult } from '../simulation-result.vo';

describe('SimulationResult', () => {
  const recorded = SimulationResult.targetFor(2, ETitleType.CDB, 3, 1);

  it('targets the title methodology', () => {
    expect(recorded.methodologyVersion).toBe('cdb-252-v1');
    expect(
      SimulationResult.targetFor(1, ETitleType.LCA, 1, null).methodologyVersion,
    ).toBe('lca-252-v1');
  });

  it('is current only when every input matches the target', () => {
    expect(SimulationResult.isCurrent(recorded, { ...recorded })).toBe(true);
    for (const changed of [
      { simulationRevision: 3 },
      { offerTermsRevision: 4 },
      { curveValuesRevision: null },
      { methodologyVersion: 'cdb-252-v0' },
    ]) {
      expect(
        SimulationResult.isCurrent(recorded, { ...recorded, ...changed }),
      ).toBe(false);
    }
  });
});
