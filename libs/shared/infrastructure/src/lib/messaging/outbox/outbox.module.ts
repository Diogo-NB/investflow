import { Global, Module } from '@nestjs/common';
import { ClockModule } from '../../clocks/clock.module';
import { EventBridgeMessageBroker } from '../eventbridge/eventbridge-message-broker';
import { MessageBroker } from './message-broker.port';
import { OutboxPollerService } from './outbox-poller.service';
import { OutboxPublisher } from './outbox-publisher';
import { OutboxRelay } from './outbox-relay';

// Global so the domain event recorder can hand committed rows to the relay of
// a host that publishes; importing it is what activates publishing.
@Global()
@Module({
  imports: [ClockModule],
  providers: [
    OutboxPublisher,
    OutboxRelay,
    OutboxPollerService,
    { provide: MessageBroker, useClass: EventBridgeMessageBroker },
  ],
  exports: [OutboxRelay],
})
export class OutboxModule {}
