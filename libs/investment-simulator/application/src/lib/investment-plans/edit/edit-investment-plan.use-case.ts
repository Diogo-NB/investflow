import { Injectable } from '@nestjs/common';
import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { InvestmentPlanRepository } from '../investment-plan.repository';
import { EditInvestmentPlanCommand } from './edit-investment-plan.command';

export interface EditInvestmentPlanOutput {
  readonly revision: number;
}

// The client's revision catches an edit made from a stale form; the
// repository's conditional write catches a change between load and save.
@Injectable()
export class EditInvestmentPlanUseCase
  implements CommandHandler<EditInvestmentPlanCommand, EditInvestmentPlanOutput>
{
  constructor(private readonly plans: InvestmentPlanRepository) {}

  async execute(
    command: EditInvestmentPlanCommand,
  ): Promise<Result<EditInvestmentPlanOutput, AppError>> {
    const plan = await this.plans.findOwned(
      command.investmentPlanId,
      command.ownerId,
    );
    if (plan.isErr()) return plan;
    const current = plan.value.assertRevision(command.revision);
    if (current.isErr()) return current;

    const edited = plan.value.editDetails({
      name: command.name,
      description: command.description,
    });
    if (edited.isErr()) return edited;
    const saved = await this.plans.save(edited.value);
    return saved.map(() => ({ revision: edited.value.revision }));
  }
}
