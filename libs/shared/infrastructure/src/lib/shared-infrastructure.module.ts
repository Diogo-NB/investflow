import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './authentication/auth.module';
import { ClockModule } from './clocks/clock.module';
import { OutboxModule } from './messaging/outbox/outbox.module';
import { PrismaModule } from './persistence/prisma/prisma.module';

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
