import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MESSAGE_BROKER } from './message-broker.port';
import { OutboxPollerService } from './outbox-poller.service';
import { OutboxTopicRegistry } from './outbox-topic.registry';
import { SnsMessageBroker } from './sns-message-broker';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    OutboxPollerService,
    OutboxTopicRegistry,
    { provide: MESSAGE_BROKER, useClass: SnsMessageBroker },
  ],
  exports: [MESSAGE_BROKER, OutboxTopicRegistry],
})
export class OutboxModule {}
