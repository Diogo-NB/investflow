import { Injectable } from '@nestjs/common';
import {
  InvestmentCalculator,
  SimulationRun,
} from '@investflow/investment-simulator-domain';
import { Clock, CommandHandler } from '@investflow/shared-application';
import { AppError, Result } from '@investflow/shared-domain';
import { ApplicationRepository } from '../../applications/application.repository';
import { findOwnedApplication } from '../../applications/shared/find-owned-application';
import { findOptionalIndexCurve } from '../../index-curves/find-optional-index-curve';
import { IndexCurveRepository } from '../../index-curves/index-curve.repository';
import { OfferRepository } from '../../offers/offer.repository';
import { SimulationRunRepository } from '../simulation-run.repository';
import { RecordSimulationRunCommand } from './record-simulation-run.command';

export interface RecordSimulationRunOutput {
  readonly id: string;
}

// Calculates the application as it stands now and records the result.
// Failed calculations are returned to the caller and never recorded.
@Injectable()
export class RecordSimulationRunUseCase
  implements
    CommandHandler<RecordSimulationRunCommand, RecordSimulationRunOutput>
{
  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly offerRepository: OfferRepository,
    private readonly indexCurveRepository: IndexCurveRepository,
    private readonly simulationRunRepository: SimulationRunRepository,
    private readonly calculator: InvestmentCalculator,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: RecordSimulationRunCommand,
  ): Promise<Result<RecordSimulationRunOutput, AppError>> {
    const application = await findOwnedApplication(
      this.applicationRepository,
      command.applicationId,
      command.ownerId,
    );
    if (application.isErr()) return application;
    const snapshot = await this.offerRepository.findById(
      application.value.offerSnapshotId,
    );
    if (snapshot.isErr()) return snapshot;
    const curve = await findOptionalIndexCurve(
      this.indexCurveRepository,
      application.value.indexCurveId,
    );
    if (curve.isErr()) return curve;

    const scenario = application.value.toScenario(snapshot.value, curve.value);
    if (scenario.isErr()) return scenario;
    const calculation = this.calculator.calculate(scenario.value);
    if (calculation.isErr()) return calculation;

    const run = SimulationRun.record({
      application: application.value,
      calculation: calculation.value,
      calculatedAt: this.clock.now(),
    });
    const saved = await this.simulationRunRepository.save(run);
    return saved.map(() => ({ id: run.id }));
  }
}
