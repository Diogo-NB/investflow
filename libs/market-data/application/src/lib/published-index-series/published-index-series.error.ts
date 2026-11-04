import { EPublishedIndex } from '@investflow/market-data-domain';
import {
  AppError,
  EAppErrorCode,
  NotFoundError,
} from '@investflow/shared-domain';

export class PublishedIndexSeriesNotFoundError extends NotFoundError {
  constructor(metadata: Readonly<Record<string, unknown>>) {
    super('Esta série de valores publicados não existe.', {
      code: EAppErrorCode.PUBLISHED_INDEX_SERIES_NOT_FOUND,
      metadata,
    });
  }
}

export class PublishedIndexImportStartDateMissingError extends AppError {
  constructor(index: EPublishedIndex) {
    super(
      `Informe a data inicial da importação de ${index}: ainda não há valores armazenados.`,
      {
        code: EAppErrorCode.PUBLISHED_INDEX_IMPORT_START_DATE_MISSING,
        kind: 'validation',
        metadata: { index },
      },
    );
  }
}

export class PublishedIndexValuesFetchError extends AppError {
  constructor(index: EPublishedIndex, cause: unknown) {
    super(`Não foi possível obter os valores publicados de ${index}.`, {
      code: EAppErrorCode.PUBLISHED_INDEX_VALUES_FETCH_FAILED,
      kind: 'external',
      metadata: { index },
      cause,
    });
  }
}
