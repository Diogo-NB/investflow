jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

import {
  FetchNewPublishedIndexValuesUseCase,
  PublishedIndexValuesFetchError,
  RecordPublishedIndexValuesUseCase,
} from '@investflow/market-data-application';
import { EPublishedIndex } from '@investflow/market-data-domain';
import { Result } from '@investflow/shared-domain';
import { UnitOfWork } from '@investflow/shared-infrastructure';
import { PublishedIndexValuesImportJob } from './published-index-values-import.job';

const batches = [2026, 2027].map((year) => ({
  index: EPublishedIndex.CDI,
  year,
  values: [],
}));

function createFixture() {
  const steps: string[] = [];
  let isInUnitOfWork = false;
  const fetchExecute = jest.fn(async () => {
    steps.push(`fetch inUnitOfWork=${isInUnitOfWork}`);
    return Result.ok(batches);
  });
  const recordExecute = jest.fn(async (command: { year: number }) => {
    steps.push(`record ${command.year} inUnitOfWork=${isInUnitOfWork}`);
    return Result.ok(undefined);
  });
  const run = jest.fn(async (work: () => Promise<void>) => {
    isInUnitOfWork = true;
    await work().finally(() => (isInUnitOfWork = false));
  });
  const job = new PublishedIndexValuesImportJob(
    { execute: fetchExecute } as unknown as FetchNewPublishedIndexValuesUseCase,
    { execute: recordExecute } as unknown as RecordPublishedIndexValuesUseCase,
    { run } as unknown as UnitOfWork,
  );
  return { job, steps, fetchExecute, recordExecute, run };
}

describe('PublishedIndexValuesImportJob', () => {
  it('fetches outside any unit of work, then records each batch in its own', async () => {
    const { job, steps, run } = createFixture();

    await job.importIndex(EPublishedIndex.CDI, null);

    expect(steps).toEqual([
      'fetch inUnitOfWork=false',
      'record 2026 inUnitOfWork=true',
      'record 2027 inUnitOfWork=true',
    ]);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('throws a failed fetch and records nothing', async () => {
    const { job, fetchExecute, recordExecute } = createFixture();
    const failure = new PublishedIndexValuesFetchError(
      EPublishedIndex.CDI,
      new Error('boom'),
    );
    fetchExecute.mockResolvedValue(Result.err(failure) as never);

    await expect(job.importIndex(EPublishedIndex.CDI, null)).rejects.toBe(
      failure,
    );
    expect(recordExecute).not.toHaveBeenCalled();
  });

  it('throws inside the unit of work so a failed batch rolls back and stops', async () => {
    const { job, recordExecute } = createFixture();
    const failure = new PublishedIndexValuesFetchError(
      EPublishedIndex.CDI,
      new Error('boom'),
    );
    recordExecute.mockResolvedValueOnce(Result.err(failure) as never);

    await expect(job.importIndex(EPublishedIndex.CDI, null)).rejects.toBe(
      failure,
    );
    expect(recordExecute).toHaveBeenCalledTimes(1);
  });
});
