import { Injectable } from '@nestjs/common';
import { InvestmentPlan } from '@investflow/investment-simulator-domain';
import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { InvestmentPlanRepository } from '../investment-plan.repository';
import { CreateInvestmentPlanCommand } from './create-investment-plan.command';

export interface CreateInvestmentPlanOutput {
  readonly investmentPlanId: string;
}

@Injectable()
export class CreateInvestmentPlanUseCase
  implements
    CommandHandler<CreateInvestmentPlanCommand, CreateInvestmentPlanOutput>
{
  constructor(private readonly plans: InvestmentPlanRepository) {}

  async execute(
    command: CreateInvestmentPlanCommand,
  ): Promise<Result<CreateInvestmentPlanOutput, AppError>> {
    const plan = InvestmentPlan.create({
      ownerId: command.ownerId,
      name: command.name,
      description: command.description,
    });
    if (plan.isErr()) return plan;

    const saved = await this.plans.save(plan.value);
    return saved.map(() => ({ investmentPlanId: plan.value.id }));
  }
}
