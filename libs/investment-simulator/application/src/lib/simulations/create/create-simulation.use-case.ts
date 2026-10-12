import { Injectable } from '@nestjs/common';
import {
  InvestmentCalculator,
  Simulation,
} from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { SimulationRepository } from '../simulation.repository';
import { SimulationPremisesService } from '../shared/simulation-premises.service';
import { CreateSimulationCommand } from './create-simulation.command';

export interface CreateSimulationOutput {
  readonly simulationId: string;
}

// A rejected calculation saves nothing, not even a new offer.
@Injectable()
export class CreateSimulationUseCase
  implements CommandHandler<CreateSimulationCommand, CreateSimulationOutput>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly premises: SimulationPremisesService,
    private readonly calculator: InvestmentCalculator,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: CreateSimulationCommand,
  ): Promise<Result<CreateSimulationOutput, AppError>> {
    const premises = await this.premises.resolve(
      command.ownerId,
      command.offer,
      command.investment.curveId,
    );
    if (premises.isErr()) return premises;

    const simulation = Simulation.create({
      ownerId: command.ownerId,
      investment: command.investment,
      offer: premises.value.offer,
      curve: premises.value.curve,
      calculator: this.calculator,
      calculatedAt: this.clock.now(),
    });
    if (simulation.isErr()) return simulation;

    const offerSaved = await this.premises.saveNewOffer(premises.value);
    if (offerSaved.isErr()) return offerSaved;
    const saved = await this.simulationRepository.save(simulation.value);
    return saved.map(() => ({ simulationId: simulation.value.id }));
  }
}
