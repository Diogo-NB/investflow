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
      path: '/planos',
      label: 'Planos',
      description:
        'Reúna as simulações em que você investiria junto, acompanhando o estado de cada uma.',
      action: 'Abrir planos',
      Icon: InvestmentPlanIcon,
    },
    {
      path: '/ofertas',
      label: 'Ofertas',
      description: 'Consulte e cadastre os títulos que suas simulações usam.',
      action: 'Abrir ofertas',
      Icon: OfferIcon,
    },
    {
      path: '/curvas',
      label: 'Curvas',
      description:
        'Mantenha as trajetórias de CDI, SELIC e IPCA que as simulações usam.',
      action: 'Abrir curvas',
      Icon: CurveIcon,
    },
  ];
