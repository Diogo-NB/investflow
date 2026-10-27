import type { SimulationListItem } from '../../../simulations/models/simulation.types';
import type { InvestmentPlanDetail } from '../../models/investment-plan.types';

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
