import { ApiError } from './api-error';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Sends a JSON request and resolves with the parsed body (undefined for 204). */
export async function requestJson<T>(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetchFn(url, { ...init, headers });
  if (!response.ok) throw await ApiError.from(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function jsonBody(value: unknown): Pick<RequestInit, 'body'> {
  return { body: JSON.stringify(value) };
}
