import { ApplicationIdCommandInput } from '../shared/application-command-input.type';

export class DeleteApplicationCommand {
  private constructor(
    readonly ownerId: string,
    readonly applicationId: string,
  ) {}

  static fromRequest(
    ownerId: string,
    params: ApplicationIdCommandInput,
  ): DeleteApplicationCommand {
    return new DeleteApplicationCommand(ownerId, params.applicationId);
  }
}
