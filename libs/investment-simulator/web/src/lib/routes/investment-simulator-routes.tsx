import { Outlet, type RouteObject } from 'react-router';
import {
  InvestmentSimulatorDepsContext,
  type InvestmentSimulatorDeps,
} from './investment-simulator-deps';

const newSimulation = () =>
  import('../simulations/feature/new-simulation-page').then((module) => ({
    Component: module.NewSimulationPage,
  }));

const workspace = () =>
  import('../simulations/feature/simulation-workspace-page').then((module) => ({
    Component: module.SimulationWorkspacePage,
  }));

const offerEditor = () =>
  import('../offers/feature/offer-editor-page').then((module) => ({
    Component: module.OfferEditorPage,
  }));

const investmentPlanEditor = () =>
  import('../investment-plans/feature/investment-plan-editor-page').then(
    (module) => ({ Component: module.InvestmentPlanEditorPage }),
  );

const curveEditor = () =>
  import('../curves/feature/curve-editor-page').then((module) => ({
    Component: module.CurveEditorPage,
  }));

export function investmentSimulatorRoutes(
  deps: InvestmentSimulatorDeps,
): RouteObject[] {
  const withDeps = (
    <InvestmentSimulatorDepsContext value={deps}>
      <Outlet />
    </InvestmentSimulatorDepsContext>
  );
  return [
    {
      path: 'simulacoes',
      element: withDeps,
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
        { path: 'nova', lazy: newSimulation },
        {
          path: 'comparar',
          lazy: () =>
            import('../simulations/feature/simulation-comparison-page').then(
              (module) => ({
                Component: module.SimulationComparisonPage,
              }),
            ),
        },
        { path: ':simulationId', lazy: workspace },
      ],
    },
    {
      path: 'planos',
      element: withDeps,
      children: [
        {
          index: true,
          lazy: () =>
            import(
              '../investment-plans/feature/investment-plan-list-page'
            ).then((module) => ({ Component: module.InvestmentPlanListPage })),
        },
        { path: 'novo', lazy: investmentPlanEditor },
        {
          path: ':investmentPlanId',
          lazy: () =>
            import(
              '../investment-plans/feature/investment-plan-details-page'
            ).then((module) => ({
              Component: module.InvestmentPlanDetailsPage,
            })),
        },
        { path: ':investmentPlanId/editar', lazy: investmentPlanEditor },
      ],
    },
    {
      path: 'ofertas',
      element: withDeps,
      children: [
        {
          index: true,
          lazy: () =>
            import('../offers/feature/offer-list-page').then((module) => ({
              Component: module.OfferListPage,
            })),
        },
        { path: 'nova', lazy: offerEditor },
        {
          path: ':offerId',
          lazy: () =>
            import('../offers/feature/offer-details-page').then((module) => ({
              Component: module.OfferDetailsPage,
            })),
        },
        { path: ':offerId/editar', lazy: offerEditor },
      ],
    },
    {
      path: 'curvas',
      element: withDeps,
      children: [
        {
          index: true,
          lazy: () =>
            import('../curves/feature/curve-list-page').then((module) => ({
              Component: module.CurveListPage,
            })),
        },
        { path: 'nova', lazy: curveEditor },
        {
          path: ':curveId',
          lazy: () =>
            import('../curves/feature/curve-details-page').then((module) => ({
              Component: module.CurveDetailsPage,
            })),
        },
        { path: ':curveId/editar', lazy: curveEditor },
      ],
    },
  ];
}
