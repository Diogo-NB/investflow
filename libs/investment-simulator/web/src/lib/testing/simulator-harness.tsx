import { Toast } from '@base-ui/react/toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import type { FetchFn } from '../http/request-json';
import {
  InvestmentSimulatorDepsContext,
  type InvestmentSimulatorToastData,
} from '../routes/investment-simulator-deps';

type Handler = (init: RequestInit) => unknown;

export interface FakeApi {
  readonly fetch: FetchFn & ReturnType<typeof vi.fn<FetchFn>>;
  calls(): string[];
  bodies(request: string): unknown[];
}

/** Routes keyed by "METHOD /api/path?query"; a handler may return a Response. */
export function fakeApi(routes: Record<string, Handler | unknown>): FakeApi {
  const fetch = vi.fn<FetchFn>(async (url, init = {}) => {
    const key = `${init.method ?? 'GET'} ${url}`;
    if (!(key in routes)) throw new Error(`Unexpected request ${key}`);
    const route = routes[key];
    const result = typeof route === 'function' ? await route(init) : route;
    if (result instanceof Response) return result;
    return result === undefined
      ? new Response(null, { status: 204 })
      : Response.json(result);
  });
  return {
    fetch,
    calls: () =>
      fetch.mock.calls.map(
        ([url, init]) =>
          `${(init as RequestInit | undefined)?.method ?? 'GET'} ${url}`,
      ),
    bodies: (request) =>
      fetch.mock.calls
        .filter(
          ([url, init]) =>
            `${(init as RequestInit | undefined)?.method ?? 'GET'} ${url}` ===
            request,
        )
        .map(([, init]) => JSON.parse(String((init as RequestInit).body))),
  };
}

export function apiFailure(
  status: number,
  code: string,
  details = {},
  message = `Mensagem de ${code}.`,
) {
  return () =>
    Response.json({ statusCode: status, code, message, details }, { status });
}

export function harness(api: FakeApi, initialEntry = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  // Tests read what the hooks asked for through spies on add and update.
  const toasts = Toast.createToastManager<InvestmentSimulatorToastData>();
  const deps = { fetch: api.fetch, toasts };
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <InvestmentSimulatorDepsContext value={deps}>
          <MemoryRouter initialEntries={[initialEntry]}>
            {children}
          </MemoryRouter>
        </InvestmentSimulatorDepsContext>
      </QueryClientProvider>
    );
  }
  return { wrapper: Wrapper, queryClient, toasts };
}

export function withLocation<T>(useHook: () => T) {
  return () => ({ hook: useHook(), location: useLocation() });
}
