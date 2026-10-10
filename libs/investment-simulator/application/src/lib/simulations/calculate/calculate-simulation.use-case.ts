import { Injectable } from '@nestjs/common';
import {
  InvestmentCalculator,
  Simulation,
  SimulationCalculation,
} from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { IssuerRepository } from '../../issuers/issuer.repository';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationCalculationRepository } from '../simulation-calculation.repository';
import { SimulationRepository } from '../simulation.repository';
import {
  CalculateSimulationCommand,
  CalculateSimulationTarget,
} from './calculate-simulation.command';

export interface CalculateSimulationOutput {
  readonly simulationId: string;
  readonly calculationId: string;
}

// Creates the simulation on its first successful calculation and appends one
// calculation per later success. A rejected calculation saves nothing.
@Injectable()
export class CalculateSimulationUseCase
  implements
    CommandHandler<CalculateSimulationCommand, CalculateSimulationOutput>
{
  constructor(
    private readonly simulationRepository: SimulationRepository,
    private readonly calculationRepository: SimulationCalculationRepository,
    private readonly offerRepository: OfferRepository,
    private readonly issuerRepository: IssuerRepository,
    private readonly indexCurveRepository: IndexCurveRepository,
    private readonly calculator: InvestmentCalculator,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: CalculateSimulationCommand,
  ): Promise<Result<CalculateSimulationOutput, AppError>> {
    const { inputs } = command;
    const simulation = await this.resolveSimulation(
      command.ownerId,
      command.target,
    );
    if (simulation.isErr()) return simulation;
    const issuer = await this.issuerRepository.findById(inputs.terms.issuerId);
    if (issuer.isErr()) return issuer;
    const curve = inputs.indexCurveId
      ? await this.indexCurveRepository.findById(inputs.indexCurveId)
      : Result.ok(null);
    if (curve.isErr()) return curve;

    const scenario = inputs.toScenario(curve.valueOrNull);
    if (scenario.isErr()) return scenario;
    const result = this.calculator.calculate(scenario.value);
    if (result.isErr()) return result;
    const calculation = SimulationCalculation.record({
      simulation: simulation.value,
      inputs,
      result: result.value,
      calculatedAt: this.clock.now(),
    });
    if (calculation.isErr()) return calculation;

    if (!('simulationId' in command.target)) {
      const created = await this.simulationRepository.save(simulation.value);
      if (created.isErr()) return created;
    }
    const saved = await this.calculationRepository.save(calculation.value);
    return saved.map(() => ({
      simulationId: simulation.value.id,
      calculationId: calculation.value.id,
    }));
  }

  private async resolveSimulation(
    ownerId: string,
    target: CalculateSimulationTarget,
  ): Promise<Result<Simulation, AppError>> {
    if ('simulationId' in target) {
      return this.simulationRepository.findById(target.simulationId, ownerId);
    }
    // Deleted catalog offers are reported as missing and cannot be a source.
    if (target.sourceOfferId) {
      const offer = await this.offerRepository.findById(target.sourceOfferId);
      if (offer.isErr()) return offer;
    }
    return Result.ok(
      Simulation.create({ ownerId, sourceOfferId: target.sourceOfferId }),
    );
  }
}
