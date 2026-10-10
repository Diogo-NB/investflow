import {
  ApplicationInvestment,
  applicationInvestmentFrom,
} from '../shared/application-investment';
import {
  ApplicationIdCommandInput,
  ApplicationInvestmentCommandInput,
} from '../shared/application-command-input.type';

export class ReviseApplicationCommand {
  private constructor(
    readonly ownerId: string,
    readonly applicationId: string,
    readonly investment: ApplicationInvestment,
  ) {}

  static fromRequest(
    ownerId: string,
    params: ApplicationIdCommandInput,
    request: ApplicationInvestmentCommandInput,
  ): ReviseApplicationCommand {
    return new ReviseApplicationCommand(
      ownerId,
      params.applicationId,
      applicationInvestmentFrom(request),
    );
  }
}
