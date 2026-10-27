export interface CreateInvestmentPlanCommandInput {
  readonly name: string;
  readonly description?: string | null;
}

export interface EditInvestmentPlanCommandInput {
  readonly revision: number;
  readonly name?: string;
  readonly description?: string | null;
}

export interface AddInvestmentPlanSimulationsCommandInput {
  readonly simulationIds: readonly string[];
}

export interface InvestmentPlanIdCommandInput {
  readonly investmentPlanId: string;
}

export interface InvestmentPlanSimulationIdCommandInput
  extends InvestmentPlanIdCommandInput {
  readonly simulationId: string;
}
