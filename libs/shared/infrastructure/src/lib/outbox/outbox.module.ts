import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MessageBroker } from './message-broker.port';
import { OutboxPollerService } from './outbox-poller.service';
import { OutboxTopicRegistry } from './outbox-topic.registry';
import { SnsMessageBroker } from './sns-message-broker';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    OutboxPollerService,
    OutboxTopicRegistry,
    { provide: MessageBroker, useClass: SnsMessageBroker },
  ],
  exports: [MessageBroker, OutboxTopicRegistry],
})
export class OutboxModule {}
