import { Injectable } from '@nestjs/common';
import {
  ESimulationCalculationCauseKind,
  SimulationCalculationService,
} from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { SimulationRepository } from '../simulation.repository';
import { SimulationPremisesService } from '../shared/simulation-premises.service';
import { EditSimulationCommand } from './edit-simulation.command';

export interface EditSimulationOutput {
  readonly revision: number;
}

// Saving always queues a calculation, so the result follows the current offer
// and curve even when nothing changed.
@Injectable()
export class EditSimulationUseCase
  implements CommandHandler<EditSimulationCommand, EditSimulationOutput>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly premises: SimulationPremisesService,
    private readonly calculation: SimulationCalculationService,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: EditSimulationCommand,
  ): Promise<Result<EditSimulationOutput, AppError>> {
    const found = await this.simulationRepository.findOwned(
      command.simulationId,
      command.ownerId,
    );
    if (found.isErr()) return found;
    const current = found.value.assertRevision(command.revision);
    if (current.isErr()) return current;

    const premises = await this.premises.resolve(
      command.ownerId,
      command.offerId,
      command.investment.curveId,
      command.simulationId,
    );
    if (premises.isErr()) return premises;
    const valid = this.calculation.validate(
      command.investment,
      premises.value.offer,
      premises.value.curve,
    );
    if (valid.isErr()) return valid;

    const edited = current.value.edit(
      { offerId: premises.value.offer.id, investment: command.investment },
      {
        kind: ESimulationCalculationCauseKind.SIMULATION_EDITED,
        actorId: command.ownerId,
      },
      this.clock.now(),
    );
    if (edited.isErr()) return edited;

    const saved = await this.simulationRepository.save(edited.value);
    return saved.map(() => ({ revision: edited.value.revision }));
  }
}
