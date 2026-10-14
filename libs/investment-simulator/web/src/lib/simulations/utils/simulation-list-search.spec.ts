import { listSearch } from './simulation-list-search';

describe('listSearch', () => {
  it("keeps only the list's filters and page", () => {
    expect(
      listSearch(
        new URLSearchParams('a-partir-de=x&titleType=CDB&page=2&tab=y'),
      ),
    ).toBe('?titleType=CDB&page=2');
    expect(listSearch(new URLSearchParams('a-partir-de=x'))).toBe('');
  });
});
