import { ApplicationIdCommandInput } from '../../applications/shared/application-command-input.type';

export class RecordSimulationRunCommand {
  private constructor(
    readonly ownerId: string,
    readonly applicationId: string,
  ) {}

  static fromRequest(
    ownerId: string,
    params: ApplicationIdCommandInput,
  ): RecordSimulationRunCommand {
    return new RecordSimulationRunCommand(ownerId, params.applicationId);
  }
}
