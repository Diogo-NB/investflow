import { Injectable } from '@nestjs/common';
import {
  ApplyPublishedIndexValuesCommand,
  ApplyPublishedIndexValuesUseCase,
} from '@investflow/investment-simulator-application';
import {
  PUBLISHED_INDEX_VALUES_IMPORTED,
  PublishedIndexValuesImportedContract,
} from '@investflow/market-data-contracts';
import { OnEvent } from '@investflow/shared-infrastructure';
import { z } from 'zod';

const publishedIndexValuesImported = z.object({
  index: z.enum(['CDI', 'SELIC']),
  values: z.array(
    z.object({ referenceDate: z.iso.date(), value: z.string().min(1) }),
  ),
}) satisfies z.ZodType<
  Pick<PublishedIndexValuesImportedContract, 'index' | 'values'>
>;

// Throwing leaves the message in the queue, which retries it and finally
// dead-letters it. A missing curve also throws: its absence is a deployment
// fault, and the dead-letter queue is where it shows.
@Injectable()
export class PublishedIndexValuesConsumer {
  constructor(
    private readonly applyPublishedIndexValues: ApplyPublishedIndexValuesUseCase,
  ) {}

  @OnEvent(PUBLISHED_INDEX_VALUES_IMPORTED)
  async onPublishedIndexValuesImported(payload: unknown): Promise<void> {
    const result = await this.applyPublishedIndexValues.execute(
      ApplyPublishedIndexValuesCommand.fromRequest(
        publishedIndexValuesImported.parse(payload),
      ),
    );
    if (result.isErr()) throw result.error;
  }
}
