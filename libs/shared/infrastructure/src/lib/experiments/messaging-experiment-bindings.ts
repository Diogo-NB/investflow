import { FactoryProvider } from '@nestjs/common';
import { DeduplicatingEventDispatcher } from '../messaging/consumers/deduplicating-event-dispatcher.service';
import { EventDispatcher } from '../messaging/consumers/event-dispatcher';
import { EventBridgeMessageBroker } from '../messaging/eventbridge/eventbridge-message-broker';
import { MessageBroker } from '../messaging/outbox/message-broker.port';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { UnitOfWork } from '../persistence/unit-of-work';
import { DeadLetteringEventDispatcher } from './dead-lettering-event-dispatcher';
import { DuplicatingEventDispatcher } from './duplicating-event-dispatcher';
import {
  EExperimentMessageFault,
  experimentsConfig,
  type ExperimentsConfig,
} from './experiments.config';
import { RejectUntilNewerMessageBroker } from './reject-until-newer-message-broker';
import { UndeduplicatedEventDispatcher } from './undeduplicated-event-dispatcher';

// The only place messaging chooses between its production implementations
// and the experiments' ones; with no switch on, each token resolves to the
// production implementation it receives.
export const eventDispatcherBinding: FactoryProvider<EventDispatcher> = {
  provide: EventDispatcher,
  useFactory: (
    unitOfWork: UnitOfWork,
    prisma: PrismaService,
    experiments: ExperimentsConfig,
  ): EventDispatcher => {
    const dispatcher = experiments.isDeduplicationSkipped
      ? new UndeduplicatedEventDispatcher(unitOfWork, prisma)
      : new DeduplicatingEventDispatcher(unitOfWork, prisma);
    const { messageFault, target } = experiments;
    if (!target) return dispatcher;
    switch (messageFault) {
      case EExperimentMessageFault.DEAD_LETTER:
        return new DeadLetteringEventDispatcher(dispatcher, target);
      case EExperimentMessageFault.DUPLICATE:
        return new DuplicatingEventDispatcher(dispatcher, target);
      default:
        return dispatcher;
    }
  },
  inject: [UnitOfWork, PrismaService, experimentsConfig.KEY],
};

export const messageBrokerBinding: FactoryProvider<MessageBroker> = {
  provide: MessageBroker,
  useFactory: (
    broker: EventBridgeMessageBroker,
    experiments: ExperimentsConfig,
  ): MessageBroker =>
    experiments.messageFault === EExperimentMessageFault.REJECT_UNTIL_NEWER &&
    experiments.target
      ? new RejectUntilNewerMessageBroker(broker, experiments.target)
      : broker,
  inject: [EventBridgeMessageBroker, experimentsConfig.KEY],
};
