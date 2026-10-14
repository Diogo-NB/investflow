export function parsePage(param: string | null): number | null {
  if (param === null) return 1;
  return /^[1-9]\d{0,6}$/.test(param) ? Number(param) : null;
}

export function toSearch(params: URLSearchParams): string {
  const search = params.toString();
  return search ? `?${search}` : '';
}

export function withPage(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page === 1) next.delete('page');
  else next.set('page', String(page));
  return toSearch(next);
}

/** Only the named parameters, carried from a list to its records and back. */
export function pickSearch(
  params: URLSearchParams,
  names: readonly string[],
): string {
  const next = new URLSearchParams();
  for (const name of names) {
    const value = params.get(name);
    if (value !== null) next.set(name, value);
  }
  return toSearch(next);
}
