import {
  ApplicationInvestment,
  applicationInvestmentFrom,
} from '../shared/application-investment';
import { CreateApplicationCommandInput } from '../shared/application-command-input.type';

export class CreateApplicationCommand {
  private constructor(
    readonly ownerId: string,
    readonly offerId: string,
    readonly investment: ApplicationInvestment,
  ) {}

  static fromRequest(
    ownerId: string,
    request: CreateApplicationCommandInput,
  ): CreateApplicationCommand {
    return new CreateApplicationCommand(
      ownerId,
      request.offerId,
      applicationInvestmentFrom(request),
    );
  }
}
