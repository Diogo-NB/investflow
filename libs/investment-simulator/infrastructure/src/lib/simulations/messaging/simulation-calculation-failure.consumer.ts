import { Injectable } from '@nestjs/common';
import {
  FailSimulationCalculationCommand,
  FailSimulationCalculationUseCase,
} from '@investflow/investment-simulator-application';
import { OnEvent } from '@investflow/shared-infrastructure';
import { simulationIdOf } from './simulation-calculation.consumer';

// Bound to the calculation queue's dead-letter queue: receives the events
// whose calculation exhausted its retries.
@Injectable()
export class SimulationCalculationFailureConsumer {
  constructor(
    private readonly failSimulationCalculation: FailSimulationCalculationUseCase,
  ) {}

  @OnEvent('SimulationCreated')
  onCreated(payload: Record<string, unknown>): Promise<void> {
    return this.fail(payload);
  }

  @OnEvent('SimulationEdited')
  onEdited(payload: Record<string, unknown>): Promise<void> {
    return this.fail(payload);
  }

  @OnEvent('SimulationCalculationRequested')
  onCalculationRequested(payload: Record<string, unknown>): Promise<void> {
    return this.fail(payload);
  }

  private async fail(payload: Record<string, unknown>): Promise<void> {
    const result = await this.failSimulationCalculation.execute(
      FailSimulationCalculationCommand.of(simulationIdOf(payload)),
    );
    if (result.isErr()) throw result.error;
  }
}
