import { listSearch, parseSort } from './simulation-list-search';

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
