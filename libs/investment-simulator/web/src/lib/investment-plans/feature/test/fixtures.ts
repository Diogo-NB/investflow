import type { SimulationListItem } from '../../../simulations/models/simulation.types';
import type {
  InvestmentPlanDetail,
  InvestmentPlanTotals,
} from '../../models/investment-plan.types';

export const API = '/api/investment-simulator';
export const PLAN_ID = '0b6a3c9e-2f4d-4a51-9d1e-7c8b5a6f3e21';
export const PLAN_URL = `${API}/investment-plans/${PLAN_ID}`;

export const settled = {
  calculatingCount: 0,
  pendingIssueCount: 0,
  outdatedResultCount: 0,
  isSettled: true,
};

export const plan: InvestmentPlanDetail = {
  id: PLAN_ID,
  name: 'Reserva',
  description: null,
  revision: 3,
  simulationCount: 2,
  availableSimulationSlots: 48,
  status: settled,
  totals: null,
};

export const totals: InvestmentPlanTotals = {
  excludedSimulationCount: 1,
  isProvisional: true,
  principal: '3000.01',
  iof: '0',
  incomeTax: '45.5',
  netFinalBalance: '3250.75',
  netEarnings: '250.74',
  period: { start: '2026-01-02', end: '2027-01-04' },
  maturityMonths: [
    {
      month: '2026-06',
      simulationCount: 1,
      maturedSimulationCount: 1,
      netFinalBalance: '1050.25',
      accumulatedNetFinalBalance: '1050.25',
    },
    {
      month: '2027-01',
      simulationCount: 2,
      maturedSimulationCount: 0,
      netFinalBalance: '2200.5',
      accumulatedNetFinalBalance: '3250.75',
    },
  ],
  liquidity: {
    dailyPrincipal: '1000',
    atMaturityPrincipal: '2000.01',
    dailyShare: '0.33333222222592591358',
    atMaturityShare: '0.66666777777407408642',
  },
};

export function simulation(id: string): SimulationListItem {
  return {
    id,
    offerName: `Oferta ${id}`,
    principal: '1000',
    investmentDate: '2026-01-02',
    maturityDate: '2027-01-04',
    titleType: 'CDB',
    issuerName: null,
    remunerationTerms: { kind: 'PREFIXED', rate: '0.12' },
    calculationStatus: 'CALCULATED',
    result: null,
  };
}

export const page = <T>(items: readonly T[], total = items.length) => ({
  items,
  total,
  page: 1,
  pageSize: 20,
});
