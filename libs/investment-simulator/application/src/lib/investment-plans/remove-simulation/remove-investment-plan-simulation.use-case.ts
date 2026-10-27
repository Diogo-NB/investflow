import { Injectable } from '@nestjs/common';
import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { InvestmentPlanRepository } from '../investment-plan.repository';
import { RemoveInvestmentPlanSimulationCommand } from './remove-investment-plan-simulation.command';

@Injectable()
export class RemoveInvestmentPlanSimulationUseCase
  implements CommandHandler<RemoveInvestmentPlanSimulationCommand, void>
{
  constructor(private readonly plans: InvestmentPlanRepository) {}

  async execute(
    command: RemoveInvestmentPlanSimulationCommand,
  ): Promise<Result<void, AppError>> {
    const plan = await this.plans.findOwned(
      command.investmentPlanId,
      command.ownerId,
    );
    if (plan.isErr()) return plan;

    return this.plans.save(plan.value.removeSimulation(command.simulationId));
  }
}
