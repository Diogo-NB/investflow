import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { awsConfig } from '../../aws/aws.config';
import { ClockModule } from '../../clocks/clock.module';
import { experimentsConfig } from '../../experiments/experiments.config';
import { messageBrokerBinding } from '../../experiments/messaging-experiment-bindings';
import { EventBridgeMessageBroker } from '../eventbridge/eventbridge-message-broker';
import { eventBridgeConfig } from '../eventbridge/eventbridge.config';
import { outboxConfig } from './outbox.config';
import { OutboxPollSchedule } from './outbox-poll-schedule';
import { OutboxPollerService } from './outbox-poller.service';
import { OutboxPublisher } from './outbox-publisher';
import { OutboxRelay } from './outbox-relay';
import { OutboxRetentionService } from './outbox-retention.service';

// Global so the domain event recorder can hand committed rows to the relay of
// a host that publishes; importing it is what activates publishing and the
// retention of published rows.
@Global()
@Module({
  imports: [
    ClockModule,
    ConfigModule.forFeature(awsConfig),
    ConfigModule.forFeature(eventBridgeConfig),
    ConfigModule.forFeature(outboxConfig),
    ConfigModule.forFeature(experimentsConfig),
  ],
  providers: [
    OutboxPollSchedule,
    OutboxPublisher,
    OutboxRelay,
    OutboxPollerService,
    OutboxRetentionService,
    EventBridgeMessageBroker,
    messageBrokerBinding,
  ],
  exports: [OutboxRelay],
})
export class OutboxModule {}
