import { Injectable } from '@nestjs/common';
import {
  PublishedIndexValuesFetchError,
  PublishedIndexValuesFetchInput,
  PublishedIndexValuesReader,
} from '@investflow/market-data-application';
import {
  EPublishedIndex,
  PublishedIndexValue,
} from '@investflow/market-data-domain';
import { CalendarDate, Result } from '@investflow/shared-domain';
import Decimal from 'decimal.js';
import { z } from 'zod';

const SGS_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const FETCH_TIMEOUT_MS = 10_000;

// CDI and SELIC are the annualized, base-252 series, in the convention of the
// curves. SELIC_TARGET lists every calendar day, up to the next Copom decision.
const SGS_SERIES_BY_INDEX: Readonly<Record<EPublishedIndex, number>> = {
  [EPublishedIndex.CDI]: 4389,
  [EPublishedIndex.SELIC]: 1178,
  [EPublishedIndex.SELIC_TARGET]: 432,
};

const sgsResponse = z.array(
  z.object({
    data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    valor: z.string().min(1),
  }),
);

@Injectable()
export class BcbPublishedIndexValuesReader extends PublishedIndexValuesReader {
  fetchBetween(
    input: PublishedIndexValuesFetchInput,
  ): Promise<
    Result<readonly PublishedIndexValue[], PublishedIndexValuesFetchError>
  > {
    return Result.fromPromise(
      () => this.fetchValues(input),
      (error) => new PublishedIndexValuesFetchError(input.index, error),
    );
  }

  private async fetchValues({
    index,
    range,
  }: PublishedIndexValuesFetchInput): Promise<readonly PublishedIndexValue[]> {
    const query = new URLSearchParams({
      formato: 'json',
      dataInicial: range.start.toPtBrString(),
      dataFinal: range.end.toPtBrString(),
    });
    const response = await fetch(
      `${SGS_URL}.${SGS_SERIES_BY_INDEX[index]}/dados?${query}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    // SGS answers 404 "Value(s) not found" for a range with nothing published.
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`SGS answered ${response.status}`);

    return sgsResponse.parse(await response.json()).map(({ data, valor }) => {
      const [day, month, year] = data.split('/');
      return PublishedIndexValue.of(
        CalendarDate.of(`${year}-${month}-${day}`),
        // SGS publishes percentages.
        new Decimal(valor).dividedBy(100),
      );
    });
  }
}
