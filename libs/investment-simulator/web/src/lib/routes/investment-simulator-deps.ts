import type { ToastManager } from '@base-ui/react/toast';
import { createContext, use } from 'react';
import type { FetchFn } from '../http/request-json';

// A toast may end with a link, which the app's toast viewport renders.
export interface InvestmentSimulatorToastData {
  readonly link?: { readonly to: string; readonly label: string };
}

export interface InvestmentSimulatorDeps {
  readonly fetch: FetchFn;
  readonly toasts: ToastManager<InvestmentSimulatorToastData>;
}

export const InvestmentSimulatorDepsContext =
  createContext<InvestmentSimulatorDeps | null>(null);

function useDeps(): InvestmentSimulatorDeps {
  const deps = use(InvestmentSimulatorDepsContext);
  if (!deps) {
    throw new Error('Investment simulator routes must provide their deps.');
  }
  return deps;
}

export function useApiFetch(): FetchFn {
  return useDeps().fetch;
}

export function useToasts(): ToastManager<InvestmentSimulatorToastData> {
  return useDeps().toasts;
}
