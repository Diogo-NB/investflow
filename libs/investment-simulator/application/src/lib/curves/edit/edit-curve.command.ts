import { CurveInterval } from '@investflow/investment-simulator-domain';
import { CreateCurveCommand } from '../create/create-curve.command';
import {
  CurveIdCommandInput,
  EditCurveCommandInput,
} from '../shared/curve-command-input.type';

export class EditCurveCommand {
  private constructor(
    readonly actorId: string | null,
    readonly curveId: string,
    readonly revision: number,
    readonly name?: string,
    readonly description?: string | null,
    readonly intervals?: readonly CurveInterval[],
  ) {}

  static fromRequest(
    actorId: string | null,
    params: CurveIdCommandInput,
    request: EditCurveCommandInput,
  ): EditCurveCommand {
    return new EditCurveCommand(
      actorId,
      params.curveId,
      request.revision,
      request.name,
      request.description,
      request.intervals && CreateCurveCommand.toIntervals(request.intervals),
    );
  }
}
