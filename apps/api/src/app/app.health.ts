import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '@investflow/shared-infrastructure';

@Injectable()
export class AppHealth {
  constructor(
    private readonly healthIndicator: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async checkDatabase(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicator.check('database');
    try {
      await this.prisma.isHealthy();
      return indicator.up();
    } catch (err: unknown) {
      return indicator.down(err instanceof Error ? err.message : 'unreachable');
    }
  }
}
