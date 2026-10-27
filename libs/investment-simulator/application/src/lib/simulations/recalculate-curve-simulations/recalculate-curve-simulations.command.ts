export class RecalculateCurveSimulationsCommand {
  private constructor(readonly curveId: string) {}

  static of(curveId: string): RecalculateCurveSimulationsCommand {
    return new RecalculateCurveSimulationsCommand(curveId);
  }
}
