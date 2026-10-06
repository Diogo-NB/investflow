import { Routes } from '@angular/router';
import { Welcome } from './welcome/welcome';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: Welcome,
    title: 'Início | InvestFlow',
  },
  {
    path: 'ofertas',
    loadChildren: () =>
      import('@investflow/investment-simulator-web').then(
        (m) => m.investmentSimulatorRoutes,
      ),
  },
  { path: '**', redirectTo: '' },
];
