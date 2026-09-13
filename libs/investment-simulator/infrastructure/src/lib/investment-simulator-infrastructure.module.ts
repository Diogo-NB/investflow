import { Module } from '@nestjs/common';
import { InvestmentSimulatorController } from './controllers/investment-simulator.controller';

@Module({
  controllers: [InvestmentSimulatorController],
})
export class InvestmentSimulatorInfrastructureModule {}
