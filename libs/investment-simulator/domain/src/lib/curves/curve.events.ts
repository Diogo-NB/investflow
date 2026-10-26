import { UtcInstant } from '@investflow/shared-domain';
import { InvestmentSimulatorEvent } from '../investment-simulator.event';

export class CurveCreated extends InvestmentSimulatorEvent {
  readonly eventType = 'CurveCreated';
  readonly aggregateType = 'Curve';

  constructor(curveId: string, occurredAt: UtcInstant) {
    super(curveId, occurredAt);
  }
}

export class CurveValuesChanged extends InvestmentSimulatorEvent {
  readonly eventType = 'CurveValuesChanged';
  readonly aggregateType = 'Curve';

  constructor(curveId: string, occurredAt: UtcInstant) {
    super(curveId, occurredAt);
  }
}

export class CurveDetailsChanged extends InvestmentSimulatorEvent {
  readonly eventType = 'CurveDetailsChanged';
  readonly aggregateType = 'Curve';

  constructor(curveId: string, occurredAt: UtcInstant) {
    super(curveId, occurredAt);
  }
}

export class CurveDeleted extends InvestmentSimulatorEvent {
  readonly eventType = 'CurveDeleted';
  readonly aggregateType = 'Curve';

  constructor(curveId: string, occurredAt: UtcInstant) {
    super(curveId, occurredAt);
  }
}
