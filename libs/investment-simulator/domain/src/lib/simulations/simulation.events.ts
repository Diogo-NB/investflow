import { UtcInstant } from '@investflow/shared-domain';
import { InvestmentSimulatorEvent } from '../investment-simulator.event';

export class SimulationCreated extends InvestmentSimulatorEvent {
  readonly eventType = 'SimulationCreated';
  readonly aggregateType = 'Simulation';

  constructor(simulationId: string, occurredAt: UtcInstant) {
    super(simulationId, occurredAt);
  }
}

// Raised on every save, also when nothing changed, since saving queues a
// calculation from the current offer and curve.
export class SimulationEdited extends InvestmentSimulatorEvent {
  readonly eventType = 'SimulationEdited';
  readonly aggregateType = 'Simulation';

  constructor(simulationId: string, occurredAt: UtcInstant) {
    super(simulationId, occurredAt);
  }
}

// A calculation asked for without changing the simulation: "Tentar novamente",
// or a change to the terms of its offer or the values of its curve.
export class SimulationCalculationRequested extends InvestmentSimulatorEvent {
  readonly eventType = 'SimulationCalculationRequested';
  readonly aggregateType = 'Simulation';

  constructor(simulationId: string, occurredAt: UtcInstant) {
    super(simulationId, occurredAt);
  }
}
