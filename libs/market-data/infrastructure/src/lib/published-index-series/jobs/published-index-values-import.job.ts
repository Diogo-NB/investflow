import { Injectable } from '@nestjs/common';
import {
  FetchNewPublishedIndexValuesCommand,
  FetchNewPublishedIndexValuesUseCase,
  RecordPublishedIndexValuesCommand,
  RecordPublishedIndexValuesUseCase,
} from '@investflow/market-data-application';
import { EPublishedIndex } from '@investflow/market-data-domain';
import { CalendarDate } from '@investflow/shared-domain';
import { UnitOfWork } from '@investflow/shared-infrastructure';

@Injectable()
export class PublishedIndexValuesImportJob {
  constructor(
    private readonly fetchNewValues: FetchNewPublishedIndexValuesUseCase,
    private readonly recordValues: RecordPublishedIndexValuesUseCase,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  // The fetch stays outside any transaction, and each year's series gets its
  // own, so one unit of work around everything would be wrong.
  async importIndex(
    index: EPublishedIndex,
    startDate: CalendarDate | null,
  ): Promise<void> {
    const batches = await this.fetchNewValues.execute(
      FetchNewPublishedIndexValuesCommand.of(index, startDate),
    );
    if (batches.isErr()) throw batches.error;

    for (const batch of batches.value) {
      await this.unitOfWork.run(async () => {
        const recorded = await this.recordValues.execute(
          RecordPublishedIndexValuesCommand.of(batch),
        );
        if (recorded.isErr()) throw recorded.error;
      });
    }
  }
}
