import { Module } from '@nestjs/common';
import { Clock } from '@investflow/shared-application';
import { SystemClock } from './system-clock.service';

@Module({
  providers: [{ provide: Clock, useClass: SystemClock }],
  exports: [Clock],
})
export class ClockModule {}
