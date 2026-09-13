import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'investment-simulator',
  },
  {
    path: 'investment-simulator',
    loadChildren: () =>
      import('@investflow/investment-simulator-web').then(
        ({ investmentSimulatorRoutes }) => investmentSimulatorRoutes,
      ),
  },
];
