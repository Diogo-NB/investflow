import { Injectable } from '@nestjs/common';
import { InvestmentCalculator } from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { SimulationCalculationRepository } from '../simulation-calculation.repository';
import { SimulationRepository } from '../simulation.repository';
import { CalculatedSimulationOutput } from '../shared/calculated-simulation.output';
import { CalculateSimulationCommand } from './calculate-simulation.command';

// Appends a calculation of another investment under the simulation's terms.
// A rejected calculation saves nothing.
@Injectable()
export class CalculateSimulationUseCase
  implements
    CommandHandler<CalculateSimulationCommand, CalculatedSimulationOutput>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly calculationRepository: SimulationCalculationRepository,
    private readonly indexCurveRepository: IndexCurveRepository,
    private readonly calculator: InvestmentCalculator,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: CalculateSimulationCommand,
  ): Promise<Result<CalculatedSimulationOutput, AppError>> {
    const simulation = await this.simulationRepository.findById(
      command.simulationId,
      command.ownerId,
    );
    if (simulation.isErr()) return simulation;
    const { indexCurveId } = command.investment;
    const curve = indexCurveId
      ? await this.indexCurveRepository.findById(indexCurveId)
      : Result.ok(null);
    if (curve.isErr()) return curve;

    const calculation = simulation.value.calculate({
      investment: command.investment,
      indexCurve: curve.valueOrNull,
      calculator: this.calculator,
      calculatedAt: this.clock.now(),
    });
    if (calculation.isErr()) return calculation;

    const saved = await this.calculationRepository.save(calculation.value);
    return saved.map(() => ({
      simulationId: simulation.value.id,
      calculationId: calculation.value.id,
    }));
  }
}
