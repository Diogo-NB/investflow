import { useId } from 'react';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatReturnPercent } from '../../decimals/format-decimal';
import { secondaryButton, surface } from '../../ui/styles';
import type { PublishedIndex } from '../api/latest-published-index-values-api';
import { useLatestPublishedIndexValues } from './use-latest-published-index-values';

const STRIP_INDEXES: readonly {
  readonly index: PublishedIndex;
  readonly label: string;
}[] = [
  { index: 'CDI', label: 'CDI' },
  { index: 'SELIC', label: 'SELIC' },
  { index: 'SELIC_TARGET', label: 'Meta SELIC' },
];

const stripWidth = 'w-full lg:w-96 lg:shrink-0';

export function LatestPublishedIndexValuesStrip() {
  const { state, retry } = useLatestPublishedIndexValues();
  const captionId = useId();

  if (state.status === 'loading') {
    return (
      <div
        aria-hidden="true"
        className={`${surface} ${stripWidth} h-24 motion-safe:animate-pulse`}
      />
    );
  }
  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className={`${stripWidth} flex flex-wrap items-center justify-between gap-3`}
      >
        <p className="m-0 text-sm text-muted">
          Não foi possível carregar os índices.
        </p>
        <button
          type="button"
          className={secondaryButton}
          disabled={state.retrying}
          onClick={retry}
        >
          {state.retrying ? 'Tentando…' : 'Tentar novamente'}
        </button>
      </div>
    );
  }
  return (
    <section
      aria-labelledby={captionId}
      className={`${stripWidth} grid gap-2 motion-safe:animate-fade-in`}
    >
      <p id={captionId} className="m-0 text-sm text-muted">
        Índices do Banco Central, ao ano
      </p>
      <dl className="m-0 grid grid-cols-3 gap-3">
        {STRIP_INDEXES.map(({ index, label }) => {
          const latest = state.values.find((value) => value.index === index);
          return (
            <div key={index} className="grid content-start gap-0.5">
              <dt className="text-sm font-medium text-fg">{label}</dt>
              <dd className="m-0 text-lg/tight font-semibold text-fg">
                {latest ? formatReturnPercent(latest.value) : '—'}
              </dd>
              {latest && (
                <dd className="m-0 text-sm text-muted">
                  {formatIsoDate(latest.referenceDate)}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
