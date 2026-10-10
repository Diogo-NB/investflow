import { createContext, use } from 'react';
import type { FetchFn } from '../http/request-json';

export interface InvestmentSimulatorDeps {
  readonly fetch: FetchFn;
}

export const InvestmentSimulatorDepsContext =
  createContext<InvestmentSimulatorDeps | null>(null);

export function useApiFetch(): FetchFn {
  const deps = use(InvestmentSimulatorDepsContext);
  if (!deps) {
    throw new Error('Investment simulator routes must provide their deps.');
  }
  return deps.fetch;
}
