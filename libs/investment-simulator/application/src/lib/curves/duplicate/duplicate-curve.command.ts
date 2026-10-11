import { CurveIdCommandInput } from '../shared/curve-command-input.type';

export class DuplicateCurveCommand {
  private constructor(
    readonly actorId: string | null,
    readonly curveId: string,
  ) {}

  static fromRequest(
    actorId: string | null,
    params: CurveIdCommandInput,
  ): DuplicateCurveCommand {
    return new DuplicateCurveCommand(actorId, params.curveId);
  }
}
