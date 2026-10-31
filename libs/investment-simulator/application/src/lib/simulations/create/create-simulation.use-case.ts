import { Injectable } from '@nestjs/common';
import {
  ESimulationCalculationCauseKind,
  Simulation,
  SimulationCalculationService,
} from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { SimulationRepository } from '../simulation.repository';
import { SimulationPremisesService } from '../shared/simulation-premises.service';
import { CreateSimulationCommand } from './create-simulation.command';

export interface CreateSimulationOutput {
  readonly simulationId: string;
}

// The calculation itself runs after the response.
@Injectable()
export class CreateSimulationUseCase
  implements CommandHandler<CreateSimulationCommand, CreateSimulationOutput>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly premises: SimulationPremisesService,
    private readonly calculation: SimulationCalculationService,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: CreateSimulationCommand,
  ): Promise<Result<CreateSimulationOutput, AppError>> {
    const premises = await this.premises.resolve(
      command.ownerId,
      command.offerId,
      command.investment.curveId,
      null,
    );
    if (premises.isErr()) return premises;
    const valid = this.calculation.validate(
      command.investment,
      premises.value.offer,
      premises.value.curve,
    );
    if (valid.isErr()) return valid;

    const simulation = Simulation.create(
      {
        ownerId: command.ownerId,
        offerId: premises.value.offer.id,
        investment: command.investment,
      },
      {
        kind: ESimulationCalculationCauseKind.CREATED,
        actorId: command.ownerId,
      },
      this.clock.now(),
    );

    const saved = await this.simulationRepository.save(simulation);
    return saved.map(() => ({ simulationId: simulation.id }));
  }
}
