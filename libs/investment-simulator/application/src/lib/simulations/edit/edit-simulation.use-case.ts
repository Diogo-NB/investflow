import { Injectable } from '@nestjs/common';
import { InvestmentCalculator } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { SimulationRepository } from '../simulation.repository';
import { SimulationPremisesService } from '../shared/simulation-premises.service';
import { EditSimulationCommand } from './edit-simulation.command';

// Saving also recalculates, so the result follows the current offer and curve.
@Injectable()
export class EditSimulationUseCase
  implements CommandHandler<EditSimulationCommand, void>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly premises: SimulationPremisesService,
    private readonly calculator: InvestmentCalculator,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: EditSimulationCommand,
  ): Promise<Result<void, AppError>> {
    const found = await this.simulationRepository.findById(
      command.simulationId,
      command.ownerId,
    );
    if (found.isErr()) return found;
    const current = found.value.assertRevision(command.revision);
    if (current.isErr()) return current;

    const premises = await this.premises.resolve(
      command.ownerId,
      command.offer,
      command.investment.curveId,
    );
    if (premises.isErr()) return premises;

    const edited = current.value.edit({
      investment: command.investment,
      offer: premises.value.offer,
      curve: premises.value.curve,
      calculator: this.calculator,
      calculatedAt: this.clock.now(),
    });
    if (edited.isErr()) return edited;

    const offerSaved = await this.premises.saveNewOffer(premises.value);
    if (offerSaved.isErr()) return offerSaved;
    return this.simulationRepository.save(edited.value);
  }
}
