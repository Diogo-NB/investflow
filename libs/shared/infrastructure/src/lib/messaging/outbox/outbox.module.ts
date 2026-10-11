import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClockModule } from '../../clocks/clock.module';
import { EventBridgeMessageBroker } from '../eventbridge/eventbridge-message-broker';
import { MessageBroker } from './message-broker.port';
import { OutboxPollerService } from './outbox-poller.service';

@Module({
  imports: [ClockModule, ScheduleModule.forRoot()],
  providers: [
    OutboxPollerService,
    { provide: MessageBroker, useClass: EventBridgeMessageBroker },
  ],
})
export class OutboxModule {}
