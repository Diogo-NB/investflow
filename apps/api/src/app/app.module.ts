import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import {
  SharedInfrastructureModule,
  OutboxModule,
  SqsConsumersModule,
  JwtAuthGuard,
  AppExceptionFilter,
} from '@investflow/shared-infrastructure';
import {
  InvestmentSimulatorInfrastructureModule,
  SimulationCalculationConsumer,
  SimulationCalculationFailureConsumer,
} from '@investflow/investment-simulator-infrastructure';
import { AppController } from './app.controller';
import { AppHealth } from './app.health';
import { HTTP_INTERCEPTOR_PROVIDERS } from './http-interceptors.providers';

@Module({
  imports: [
    SharedInfrastructureModule,
    OutboxModule,
    InvestmentSimulatorInfrastructureModule,
    SqsConsumersModule.register([
      {
        consumer: SimulationCalculationConsumer,
        queueUrlConfigKey: 'SIMULATION_CALCULATIONS_QUEUE_URL',
      },
      {
        consumer: SimulationCalculationFailureConsumer,
        queueUrlConfigKey: 'SIMULATION_CALCULATIONS_DLQ_URL',
      },
    ]),
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
