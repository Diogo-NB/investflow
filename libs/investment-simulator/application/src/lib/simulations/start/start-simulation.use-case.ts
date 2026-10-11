import { Injectable } from '@nestjs/common';
import {
  InvestmentCalculator,
  Simulation,
} from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { CurveNotFoundError } from '../../curves/curve-not-found.error';
import { CurveRepository } from '../../curves/curve.repository';
import { OfferNotFoundError } from '../../offers/offer-not-found.error';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationCalculationRepository } from '../simulation-calculation.repository';
import { SimulationRepository } from '../simulation.repository';
import { CalculatedSimulationOutput } from '../shared/calculated-simulation.output';
import { StartSimulationCommand } from './start-simulation.command';

// A rejected first calculation saves nothing; the simulation does not exist.
@Injectable()
export class StartSimulationUseCase
  implements CommandHandler<StartSimulationCommand, CalculatedSimulationOutput>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly calculationRepository: SimulationCalculationRepository,
    private readonly offerRepository: OfferRepository,
    private readonly curveRepository: CurveRepository,
    private readonly calculator: InvestmentCalculator,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: StartSimulationCommand,
  ): Promise<Result<CalculatedSimulationOutput, AppError>> {
    // Deleted offers are reported as missing and cannot be a source.
    if (command.sourceOfferId) {
      const offer = await this.offerRepository.findById(command.sourceOfferId);
      if (offer.isErr()) return offer;
      if (!offer.value.isVisibleTo(command.ownerId)) {
        return Result.err(new OfferNotFoundError(offer.value.id));
      }
    }
    const { curveId } = command.investment;
    const curve = curveId
      ? await this.curveRepository.findById(curveId)
      : Result.ok(null);
    if (curve.isErr()) return curve;
    if (curve.value && !curve.value.isVisibleTo(command.ownerId)) {
      return Result.err(new CurveNotFoundError(curve.value.id));
    }

    const started = Simulation.start({
      ownerId: command.ownerId,
      sourceOfferId: command.sourceOfferId,
      terms: command.terms,
      investment: command.investment,
      curve: curve.value,
      calculator: this.calculator,
      calculatedAt: this.clock.now(),
    });
    if (started.isErr()) return started;
    const { simulation, calculation } = started.value;

    const created = await this.simulationRepository.save(simulation);
    if (created.isErr()) return created;
    const saved = await this.calculationRepository.save(calculation);
    return saved.map(() => ({
      simulationId: simulation.id,
      calculationId: calculation.id,
    }));
  }
}
