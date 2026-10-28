export class BuildInvestmentPlanTotalsQuery {
  private constructor(
    readonly ownerId: string,
    readonly investmentPlanId: string,
  ) {}

  static of(
    ownerId: string,
    investmentPlanId: string,
  ): BuildInvestmentPlanTotalsQuery {
    return new BuildInvestmentPlanTotalsQuery(ownerId, investmentPlanId);
  }
}
