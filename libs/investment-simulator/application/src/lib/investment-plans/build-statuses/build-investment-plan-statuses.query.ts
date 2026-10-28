export class BuildInvestmentPlanStatusesQuery {
  private constructor(
    readonly ownerId: string,
    readonly investmentPlanIds: readonly string[],
  ) {}

  static of(
    ownerId: string,
    investmentPlanIds: readonly string[],
  ): BuildInvestmentPlanStatusesQuery {
    return new BuildInvestmentPlanStatusesQuery(ownerId, [
      ...investmentPlanIds,
    ]);
  }
}
