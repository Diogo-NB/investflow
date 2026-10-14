import { OfferIcon, SimulationIcon, type IconComponent } from '../ui/icons';

export interface InvestmentSimulatorSection {
  readonly path: string;
  readonly label: string;
  readonly description: string;
  readonly action: string;
  readonly Icon: IconComponent;
}

// The context's screens as the app's header and welcome page link to them.
export const investmentSimulatorSections: readonly InvestmentSimulatorSection[] =
  [
    {
      path: '/simulacoes',
      label: 'Simulações',
      description:
        'Calcule o resultado líquido no vencimento e compare cenários.',
      action: 'Abrir simulações',
      Icon: SimulationIcon,
    },
    {
      path: '/ofertas',
      label: 'Ofertas',
      description: 'Consulte e cadastre os títulos que suas simulações usam.',
      action: 'Abrir ofertas',
      Icon: OfferIcon,
    },
  ];
