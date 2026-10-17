import { toSearch } from '../../pagination/page-search';

export const MIN_COMPARED = 2;
export const MAX_COMPARED = 6;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The valid, distinct ids of a comma-separated parameter, at most
 * MAX_COMPARED, and whether the URL held anything else.
 */
export function parseSimulationIds(value: string | null): {
  readonly ids: readonly string[];
  readonly invalid: boolean;
} {
  if (value === null) return { ids: [], invalid: false };
  const ids = [
    ...new Set(value.split(',').filter((id) => UUID.test(id))),
  ].slice(0, MAX_COMPARED);
  return { ids, invalid: ids.length === 0 || ids.join(',') !== value };
}

/** The comparison of these simulations, relative to the list. */
export function comparisonSearch(ids: readonly string[]): string {
  return toSearch(new URLSearchParams({ ids: ids.join(',') }));
}

/** The list with these simulations selected for comparison. */
export function selectionSearch(ids: readonly string[]): string {
  return ids.length
    ? toSearch(new URLSearchParams({ comparar: ids.join(',') }))
    : '';
}
