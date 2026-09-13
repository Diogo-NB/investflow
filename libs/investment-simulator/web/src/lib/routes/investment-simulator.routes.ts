import { Routes } from '@angular/router';
import { InvestmentSimulatorPage } from '../feature/investment-simulator-page.component';

export const investmentSimulatorRoutes: Routes = [
  {
    path: '',
    component: InvestmentSimulatorPage,
    title: 'Simulador de investimentos | InvestFlow',
  },
];
