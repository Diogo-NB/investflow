import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { SharedInfrastructureModule } from '@investflow/shared-infrastructure';
import { AppController } from './app.controller';
import { AppHealth } from './app.health';

@Module({
  imports: [SharedInfrastructureModule, TerminusModule],
  controllers: [AppController],
  providers: [AppHealth],
})
export class AppModule {}
