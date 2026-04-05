import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { SharedInfrastructureModule, JwtAuthGuard, RolesGuard } from '@investflow/shared-infrastructure';
import { AppController } from './app.controller';
import { AppHealth } from './app.health';

@Module({
  imports: [SharedInfrastructureModule, TerminusModule],
  controllers: [AppController],
  providers: [
    AppHealth,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
