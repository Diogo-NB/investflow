import { Injectable } from '@nestjs/common';
import {
  RecalculateCurveSimulationsCommand,
  RecalculateCurveSimulationsUseCase,
  RecalculateOfferSimulationsCommand,
  RecalculateOfferSimulationsUseCase,
} from '@investflow/investment-simulator-application';
import { OnEvent } from '@investflow/shared-infrastructure';
import { aggregateIdOf } from './simulation-calculation.consumer';

// Every offer or curve change a calculation reads. Throwing leaves the message
// in the queue, which retries it and finally dead-letters it; no consumer
// reads that dead-letter queue, since a failed fan-out wrote nothing.
@Injectable()
export class SimulationRecalculationConsumer {
  constructor(
    private readonly recalculateOfferSimulations: RecalculateOfferSimulationsUseCase,
    private readonly recalculateCurveSimulations: RecalculateCurveSimulationsUseCase,
  ) {}

  @OnEvent('OfferTermsChanged')
  onOfferTermsChanged(payload: Record<string, unknown>): Promise<void> {
    return this.recalculateOffer(payload);
  }

  @OnEvent('OfferDeleted')
  onOfferDeleted(payload: Record<string, unknown>): Promise<void> {
    return this.recalculateOffer(payload);
  }

  @OnEvent('CurveValuesChanged')
  onCurveValuesChanged(payload: Record<string, unknown>): Promise<void> {
    return this.recalculateCurve(payload);
  }

  @OnEvent('CurveDeleted')
  onCurveDeleted(payload: Record<string, unknown>): Promise<void> {
    return this.recalculateCurve(payload);
  }

  private async recalculateOffer(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const result = await this.recalculateOfferSimulations.execute(
      RecalculateOfferSimulationsCommand.of(aggregateIdOf(payload)),
    );
    if (result.isErr()) throw result.error;
  }

  private async recalculateCurve(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const result = await this.recalculateCurveSimulations.execute(
      RecalculateCurveSimulationsCommand.of(aggregateIdOf(payload)),
    );
    if (result.isErr()) throw result.error;
  }
}
