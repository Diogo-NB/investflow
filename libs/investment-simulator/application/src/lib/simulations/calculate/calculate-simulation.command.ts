export class CalculateSimulationCommand {
  private constructor(readonly simulationId: string) {}

  static of(simulationId: string): CalculateSimulationCommand {
    return new CalculateSimulationCommand(simulationId);
  }
}
