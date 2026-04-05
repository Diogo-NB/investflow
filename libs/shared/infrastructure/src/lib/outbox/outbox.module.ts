import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConsoleMessageBroker } from './console-message-broker';
import { MESSAGE_BROKER } from './message-broker.port';
import { OutboxPollerService } from './outbox-poller.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    OutboxPollerService,
    { provide: MESSAGE_BROKER, useClass: ConsoleMessageBroker },
  ],
  exports: [MESSAGE_BROKER],
})
export class OutboxModule {}
