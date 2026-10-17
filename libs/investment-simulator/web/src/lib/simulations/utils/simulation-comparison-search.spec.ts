import {
  comparisonSearch,
  parseSimulationIds,
  selectionSearch,
} from './simulation-comparison-search';

const A = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const B = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';

describe('parseSimulationIds', () => {
  it('reads distinct valid ids', () => {
    expect(parseSimulationIds(`${A},${B}`)).toEqual({
      ids: [A, B],
      invalid: false,
    });
    expect(parseSimulationIds(null)).toEqual({ ids: [], invalid: false });
  });

  it('flags malformed and repeated ids', () => {
    expect(parseSimulationIds(`${A},nope,${A}`)).toEqual({
      ids: [A],
      invalid: true,
    });
    expect(parseSimulationIds('')).toEqual({ ids: [], invalid: true });
  });
});

describe('comparison links', () => {
  it('builds the comparison and the selection searches', () => {
    expect(comparisonSearch([A, B])).toBe(`?ids=${A}%2C${B}`);
    expect(selectionSearch([A])).toBe(`?comparar=${A}`);
    expect(selectionSearch([])).toBe('');
  });
});
