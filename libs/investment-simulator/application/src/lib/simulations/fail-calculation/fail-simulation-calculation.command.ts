export class FailSimulationCalculationCommand {
  private constructor(readonly simulationId: string) {}

  static of(simulationId: string): FailSimulationCalculationCommand {
    return new FailSimulationCalculationCommand(simulationId);
  }
}
