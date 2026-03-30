import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipTransaction } from '@investflow/shared-infrastructure';
import { AppHealth } from './app.health';

@Controller()
export class AppController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly appHealth: AppHealth,
  ) {}

  @SkipTransaction()
  @Get('health-check')
  @HealthCheck()
  check() {
    return this.health.check([() => this.appHealth.checkDatabase()]);
  }
}
