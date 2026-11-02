import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DomainEventRecorder } from '@investflow/shared-domain';
import { ClockModule } from '../../clocks/clock.module';
import { TransactionalDomainEventRecorder } from '../../messaging/outbox/transactional-domain-event-recorder';
import { UnitOfWork } from '../unit-of-work';
import { databaseConfig } from './database.config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [ClockModule, ConfigModule.forFeature(databaseConfig)],
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
