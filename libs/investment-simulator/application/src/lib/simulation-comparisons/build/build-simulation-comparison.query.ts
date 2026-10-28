export class BuildSimulationComparisonQuery {
  private constructor(
    readonly ownerId: string,
    readonly simulationIds: readonly string[],
  ) {}

  // Distinct, between the comparison's minimum and maximum.
  static of(
    ownerId: string,
    simulationIds: readonly string[],
  ): BuildSimulationComparisonQuery {
    return new BuildSimulationComparisonQuery(ownerId, [...simulationIds]);
  }
}
