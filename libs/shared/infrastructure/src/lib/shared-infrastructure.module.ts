import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClockModule } from './clock/clock.module';
import { OutboxModule } from './outbox/outbox.module';
import { PrismaModule } from './prisma/prisma.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClockModule,
    PrismaModule,
    AuthModule,
    OutboxModule,
  ],
  exports: [ClockModule, PrismaModule, AuthModule, OutboxModule],
})
export class SharedInfrastructureModule {}
