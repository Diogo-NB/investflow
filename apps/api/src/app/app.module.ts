import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import {
  SharedInfrastructureModule,
  JwtAuthGuard,
  AppExceptionFilter,
} from '@investflow/shared-infrastructure';
import { InvestmentSimulatorInfrastructureModule } from '@investflow/investment-simulator-infrastructure';
import { AppController } from './app.controller';
import { AppHealth } from './app.health';
import { HTTP_INTERCEPTOR_PROVIDERS } from './http-interceptors.providers';

@Module({
  imports: [
    SharedInfrastructureModule,
    InvestmentSimulatorInfrastructureModule,
    TerminusModule,
  ],
  controllers: [AppController],
  providers: [
    AppHealth,
    ...HTTP_INTERCEPTOR_PROVIDERS,
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
