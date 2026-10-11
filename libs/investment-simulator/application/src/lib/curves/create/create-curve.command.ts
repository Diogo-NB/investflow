import {
  CurveInterval,
  EEconomicIndex,
  IndexValue,
} from '@investflow/investment-simulator-domain';
import { CalendarDate, CalendarDateRange } from '@investflow/shared-domain';
import {
  CreateCurveCommandInput,
  CurveIntervalCommandInput,
} from '../shared/curve-command-input.type';

export class CreateCurveCommand {
  private constructor(
    // Null is the system, used by seed and import processes.
    readonly actorId: string | null,
    readonly index: EEconomicIndex,
    readonly name: string,
    readonly description: string | null,
    readonly intervals: readonly CurveInterval[],
  ) {}

  static fromRequest(
    actorId: string | null,
    request: CreateCurveCommandInput,
  ): CreateCurveCommand {
    return new CreateCurveCommand(
      actorId,
      request.index,
      request.name,
      request.description ?? null,
      CreateCurveCommand.toIntervals(request.intervals),
    );
  }

  static toIntervals(
    intervals: readonly CurveIntervalCommandInput[],
  ): CurveInterval[] {
    return intervals.map((interval) =>
      CurveInterval.create(
        CalendarDateRange.of(
          CalendarDate.of(interval.startDate),
          CalendarDate.of(interval.endDate),
        ),
        IndexValue.of(interval.value),
      ),
    );
  }
}
