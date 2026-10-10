import {
  investmentSimulatorRoutes,
  type InvestmentSimulatorDeps,
} from '@investflow/investment-simulator-web';
import { Navigate, type RouteObject } from 'react-router';
import { RouteError } from './route-error';
import { Shell } from './shell';
import { Welcome } from './welcome/welcome';

export function createAppRoutes(deps: InvestmentSimulatorDeps): RouteObject[] {
  return [
    {
      Component: Shell,
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
