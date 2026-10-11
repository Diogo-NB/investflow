import {
  DomainEvent,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';

export abstract class InvestmentSimulatorEvent implements DomainEvent {
  readonly eventId = generateUuid();
  readonly version: number = 1;
  readonly context = 'investment-simulator';
  abstract readonly eventType: string;
  abstract readonly aggregateType: string;

  protected constructor(
    readonly aggregateId: string,
    readonly occurredAt: UtcInstant,
  ) {}
}
