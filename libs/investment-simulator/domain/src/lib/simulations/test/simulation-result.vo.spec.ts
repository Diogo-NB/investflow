import { ETitleType } from '../../offers/title-type.enum';
import {
  SimulationPremiseVersions,
  SimulationResult,
} from '../simulation-result.vo';

describe('SimulationResult', () => {
  const premises: SimulationPremiseVersions = {
    simulationRevision: 2,
    offer: { titleType: ETitleType.CDB, termsRevision: 3 },
    curveValuesRevision: 1,
  };
  const recorded = SimulationResult.inputFingerprintFor(premises);

  it('has the same input fingerprint for the same premises', () => {
    expect(
      recorded.equals(SimulationResult.inputFingerprintFor({ ...premises })),
    ).toBe(true);
  });

  it.each<[string, Partial<SimulationPremiseVersions>]>([
    ['the simulation', { simulationRevision: 3 }],
    [
      'the offer terms',
      { offer: { titleType: ETitleType.CDB, termsRevision: 4 } },
    ],
    ['the curve values', { curveValuesRevision: 2 }],
    ['the curve', { curveValuesRevision: null }],
    [
      'the methodology of the title type',
      { offer: { titleType: ETitleType.LCA, termsRevision: 3 } },
    ],
    ['a missing offer', { offer: null }],
  ])('has another input fingerprint after %s changed', (_, change) => {
    expect(
      recorded.equals(
        SimulationResult.inputFingerprintFor({ ...premises, ...change }),
      ),
    ).toBe(false);
  });
});
