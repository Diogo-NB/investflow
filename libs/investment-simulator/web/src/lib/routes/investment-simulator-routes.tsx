import { Outlet, type RouteObject } from 'react-router';
import {
  InvestmentSimulatorDepsContext,
  type InvestmentSimulatorDeps,
} from './investment-simulator-deps';

const workspace = () =>
  import('../simulations/feature/simulation-workspace-page').then((module) => ({
    Component: module.SimulationWorkspacePage,
  }));

export function investmentSimulatorRoutes(
  deps: InvestmentSimulatorDeps,
): RouteObject[] {
  return [
    {
      path: 'simulacoes',
      element: (
        <InvestmentSimulatorDepsContext value={deps}>
          <Outlet />
        </InvestmentSimulatorDepsContext>
      ),
      children: [
        {
          index: true,
          lazy: () =>
            import('../simulations/feature/simulation-list-page').then(
              (module) => ({
                Component: module.SimulationListPage,
              }),
            ),
        },
        { path: 'nova', lazy: workspace },
        { path: ':simulationId', lazy: workspace },
      ],
    },
  ];
}
