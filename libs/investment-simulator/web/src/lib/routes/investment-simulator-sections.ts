import {
  CurveIcon,
  InvestmentPlanIcon,
  OfferIcon,
  SimulationIcon,
  type IconComponent,
} from '../ui/icons';

export interface InvestmentSimulatorSection {
  readonly path: string;
  readonly label: string;
  readonly Icon: IconComponent;
}

// The context's screens as the app's header links to them.
export const investmentSimulatorSections: readonly InvestmentSimulatorSection[] =
  [
    {
      path: '/simulacoes',
      label: 'Simulações',
      Icon: SimulationIcon,
    },
    {
      path: '/planos',
      label: 'Planos',
      Icon: InvestmentPlanIcon,
    },
    {
      path: '/ofertas',
      label: 'Ofertas',
      Icon: OfferIcon,
    },
    {
      path: '/curvas',
      label: 'Curvas',
      Icon: CurveIcon,
    },
  ];
