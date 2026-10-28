import {
  listSearch,
  listSearchSelecting,
  parseFilters,
  parseSort,
} from '../simulation-list-search';

const A = 'b51b8f16-2b90-4d24-a2f9-5923eb77c16c';
const B = '3bdb3c5d-fb4d-4a52-82a3-8122493ffc7e';

describe('listSearch', () => {
  it("keeps only the list's filters and page", () => {
    expect(
      listSearch(
        new URLSearchParams(
          'a-partir-de=x&titleType=CDB&sort=netAnnualReturn&page=2&tab=y',
        ),
      ),
    ).toBe('?titleType=CDB&sort=netAnnualReturn&page=2');
    expect(listSearch(new URLSearchParams('a-partir-de=x'))).toBe('');
    expect(listSearch(new URLSearchParams(`comparar=${A}`))).toBe(
      `?comparar=${A}`,
    );
  });
});

describe('parseFilters', () => {
  it('accepts a trimmed search of up to 100 characters', () => {
    expect(parseFilters(new URLSearchParams('q=Banco+X'))).toEqual({
      filters: { q: 'Banco X' },
      invalid: [],
    });
    for (const q of ['', ' Banco', 'x'.repeat(101)]) {
      expect(parseFilters(new URLSearchParams({ q }))).toEqual({
        filters: {},
        invalid: ['q'],
      });
    }
  });
});

describe('listSearchSelecting', () => {
  it('adds the simulation to the selection once', () => {
    expect(
      listSearchSelecting(
        new URLSearchParams(`titleType=CDB&comparar=${A}`),
        B,
      ),
    ).toBe(`?titleType=CDB&comparar=${B}%2C${A}`);
    expect(listSearchSelecting(new URLSearchParams(`comparar=${A}`), A)).toBe(
      `?comparar=${A}`,
    );
  });
});

describe('parseSort', () => {
  it('accepts the net annual return and flags anything else', () => {
    expect(parseSort(new URLSearchParams())).toEqual({
      sort: undefined,
      invalid: false,
    });
    expect(parseSort(new URLSearchParams('sort=netAnnualReturn'))).toEqual({
      sort: 'netAnnualReturn',
      invalid: false,
    });
    expect(parseSort(new URLSearchParams('sort=name'))).toEqual({
      sort: undefined,
      invalid: true,
    });
  });
});
