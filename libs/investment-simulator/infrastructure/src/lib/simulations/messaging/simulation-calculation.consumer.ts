import { Injectable } from '@nestjs/common';
import {
  CalculateSimulationCommand,
  CalculateSimulationUseCase,
} from '@investflow/investment-simulator-application';
import { OnEvent } from '@investflow/shared-infrastructure';

// Every event that leaves a simulation waiting for its calculation. Throwing
// leaves the message in the queue, which retries it and finally dead-letters
// it.
@Injectable()
export class SimulationCalculationConsumer {
  constructor(
    private readonly calculateSimulation: CalculateSimulationUseCase,
  ) {}

  @OnEvent('SimulationCreated')
  onCreated(payload: Record<string, unknown>): Promise<void> {
    return this.calculate(payload);
  }

  @OnEvent('SimulationEdited')
  onEdited(payload: Record<string, unknown>): Promise<void> {
    return this.calculate(payload);
  }

  @OnEvent('SimulationCalculationRequested')
  onCalculationRequested(payload: Record<string, unknown>): Promise<void> {
    return this.calculate(payload);
  }

  private async calculate(payload: Record<string, unknown>): Promise<void> {
    const result = await this.calculateSimulation.execute(
      CalculateSimulationCommand.of(aggregateIdOf(payload)),
    );
    if (result.isErr()) throw result.error;
  }
}

export function aggregateIdOf(payload: Record<string, unknown>): string {
  const { aggregateId, eventType } = payload;
  if (typeof aggregateId !== 'string') {
    throw new Error(`${String(eventType)} without aggregateId`);
  }
  return aggregateId;
}
