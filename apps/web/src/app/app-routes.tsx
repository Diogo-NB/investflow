import {
  investmentSimulatorRoutes,
  type InvestmentSimulatorDeps,
} from '@investflow/investment-simulator-web';
import { Navigate, type RouteObject } from 'react-router';
import { RouteError } from './route-error';
import { Shell } from './shell';
import { Welcome } from './welcome/welcome';

// Shown while the first page's lazy module loads on a full page load.
function AppLoading() {
  return (
    <p role="status" className="m-0 p-6 text-muted">
      Carregando…
    </p>
  );
}

export function createAppRoutes(deps: InvestmentSimulatorDeps): RouteObject[] {
  return [
    {
      Component: Shell,
      HydrateFallback: AppLoading,
      children: [
        {
          // Inside the shell so the header and logout stay available on failure.
          ErrorBoundary: RouteError,
          children: [
            { index: true, Component: Welcome },
            ...investmentSimulatorRoutes(deps),
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ],
    },
  ];
}
