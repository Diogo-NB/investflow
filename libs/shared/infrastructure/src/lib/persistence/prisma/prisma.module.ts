import { Global, Module } from '@nestjs/common';
import { DomainEventRecorder } from '@investflow/shared-domain';
import { ClockModule } from '../../clocks/clock.module';
import { TransactionalDomainEventRecorder } from '../../messaging/outbox/transactional-domain-event-recorder';
import { UnitOfWork } from '../unit-of-work';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [ClockModule],
  providers: [
    PrismaService,
    UnitOfWork,
    {
      provide: DomainEventRecorder,
      useClass: TransactionalDomainEventRecorder,
    },
  ],
  exports: [PrismaService, UnitOfWork, DomainEventRecorder],
})
export class PrismaModule {}
