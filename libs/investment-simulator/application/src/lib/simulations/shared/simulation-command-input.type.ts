export interface InvestmentCommandInput {
  readonly principal: string;
  readonly investmentDate: string;
  readonly curveId?: string | null;
}

export interface CreateSimulationCommandInput {
  readonly offerId: string;
  readonly investment: InvestmentCommandInput;
}

export interface EditSimulationCommandInput
  extends CreateSimulationCommandInput {
  readonly revision: number;
}

export interface SimulationIdCommandInput {
  readonly simulationId: string;
}
