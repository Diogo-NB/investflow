import { CurveIdCommandInput } from '../shared/curve-command-input.type';

export class DeleteCurveCommand {
  private constructor(
    readonly actorId: string | null,
    readonly curveId: string,
  ) {}

  static fromRequest(
    actorId: string | null,
    params: CurveIdCommandInput,
  ): DeleteCurveCommand {
    return new DeleteCurveCommand(actorId, params.curveId);
  }
}
