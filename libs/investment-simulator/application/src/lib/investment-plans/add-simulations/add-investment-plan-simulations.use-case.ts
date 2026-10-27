import { Injectable } from '@nestjs/common';
import { CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { SimulationNotFoundError } from '../../simulations/simulation-not-found.error';
import { SimulationRepository } from '../../simulations/simulation.repository';
import { InvestmentPlanRepository } from '../investment-plan.repository';
import { AddInvestmentPlanSimulationsCommand } from './add-investment-plan-simulations.command';

// Changes only the plan; the simulations are only checked to be the owner's
// and live. Adding and removing overwrite nothing, so a stale client view
// needs no revision; the repository's conditional write still keeps two
// concurrent adds from passing the limit together.
@Injectable()
export class AddInvestmentPlanSimulationsUseCase
  implements CommandHandler<AddInvestmentPlanSimulationsCommand, void>
{
  constructor(
    private readonly plans: InvestmentPlanRepository,
    private readonly simulations: SimulationRepository,
  ) {}

  async execute(
    command: AddInvestmentPlanSimulationsCommand,
  ): Promise<Result<void, AppError>> {
    const plan = await this.plans.findOwned(
      command.investmentPlanId,
      command.ownerId,
    );
    if (plan.isErr()) return plan;
    const owned = await this.simulations.findIdsOwnedBy(
      command.ownerId,
      command.simulationIds,
    );
    if (owned.isErr()) return owned;
    const missing = command.simulationIds.find(
      (id) => !owned.value.includes(id),
    );
    if (missing) return Result.err(new SimulationNotFoundError(missing));

    const added = plan.value.addSimulations(command.simulationIds);
    if (added.isErr()) return added;
    return this.plans.save(added.value);
  }
}
