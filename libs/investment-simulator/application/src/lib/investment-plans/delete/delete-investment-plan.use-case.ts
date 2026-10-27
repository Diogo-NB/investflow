import { Injectable } from '@nestjs/common';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { InvestmentPlanRepository } from '../investment-plan.repository';
import { DeleteInvestmentPlanCommand } from './delete-investment-plan.command';

// Its simulations stay; only the plan goes.
@Injectable()
export class DeleteInvestmentPlanUseCase
  implements CommandHandler<DeleteInvestmentPlanCommand, void>
{
  constructor(
    private readonly plans: InvestmentPlanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: DeleteInvestmentPlanCommand,
  ): Promise<Result<void, AppError>> {
    const plan = await this.plans.findOwned(
      command.investmentPlanId,
      command.ownerId,
    );
    if (plan.isErr()) return plan;

    return this.plans.save(plan.value.delete(this.clock.now()));
  }
}
