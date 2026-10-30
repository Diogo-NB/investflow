import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
import { EmptyState } from '../../ui/empty-state';
import {
  ArrowRightIcon,
  CopyIcon,
  OfferIcon,
  PencilIcon,
  SimulationIcon,
  SpinningRefreshIcon,
  TrashIcon,
} from '../../ui/icons';
import { ListSkeleton } from '../../ui/list-skeleton';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import {
  primaryButton,
  quietButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import {
  issuerAndNameLabel,
  offerTermsLabel,
  REDEMPTION_LABELS,
  REMUNERATION_LABELS,
  remunerationLabel,
} from '../models/offer-terms';
import type { OfferSummary } from '../models/offer.types';
import {
  useOfferDetails,
  type OfferSimulationsState,
} from './use-offer-details';

const ConfirmDialog = lazy(() =>
  import('../../ui/confirm-dialog').then((module) => ({
    default: module.ConfirmDialog,
  })),
);

function simulationCount(total: number): string {
  return total === 1 ? '1 simulação' : `${total} simulações`;
}

function OfferTerms({ offer }: { readonly offer: OfferSummary }) {
  const terms: [string, string][] = [
    ['Título', offer.titleType],
    ['Emissor', offer.issuerName ?? 'Sem emissor'],
    ['Remuneração', REMUNERATION_LABELS[offer.remunerationTerms.kind]],
    ['Taxa', remunerationLabel(offer.remunerationTerms)],
    ['Vencimento', formatIsoDate(offer.maturityDate)],
    ['Liquidez', REDEMPTION_LABELS[offer.redemptionTerms.kind]],
    ['Origem', offer.origin === 'SYSTEM' ? 'Do sistema' : 'Minha oferta'],
  ];
  return (
    <dl
      className={`${surface} m-0 grid gap-x-6 gap-y-3 p-6 motion-safe:animate-fade-in sm:grid-cols-2`}
    >
      {terms.map(([label, value]) => (
        <div key={label} className="grid gap-0.5">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="m-0 font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function OfferSimulations({
  offerId,
  state,
  onRetry,
}: {
  readonly offerId: string;
  readonly state: OfferSimulationsState;
  readonly onRetry: () => void;
}) {
  return (
    <section aria-labelledby="offer-simulations-title" className="grid gap-3">
      <h2
        id="offer-simulations-title"
        className="m-0 flex items-center gap-2 text-lg font-semibold"
      >
        <SimulationIcon className="size-5 shrink-0 text-accent" />
        Simulações com esta oferta
      </h2>
      <div className={surface}>
        {state.status === 'loading' && (
          <ListSkeleton label="Carregando simulações…" />
        )}
        {state.status === 'error' && (
          <div role="alert" className="grid justify-items-start gap-4 p-6">
            <p className="m-0">Não foi possível carregar as simulações.</p>
            <button
              type="button"
              className={secondaryButton}
              disabled={state.retrying}
              onClick={onRetry}
            >
              {state.retrying ? 'Tentando…' : 'Tentar novamente'}
            </button>
          </div>
        )}
        {state.status === 'ready' && state.total === 0 && (
          <EmptyState icon={SimulationIcon}>
            <p className="m-0 text-muted">
              Nenhuma das suas simulações usa esta oferta.
            </p>
          </EmptyState>
        )}
        {state.status === 'ready' && state.total > 0 && (
          <ul className="m-0 grid list-none p-0 motion-safe:animate-fade-in">
            {state.items.map((item) => (
              <li
                key={item.id}
                className="border-b border-border last:border-b-0"
              >
                <Link
                  to={`/simulacoes/${item.id}`}
                  className="group flex flex-wrap items-center justify-between gap-2 p-4 text-fg no-underline transition-colors duration-150 hover:bg-accent-soft"
                >
                  <span className="flex items-center gap-3 font-medium text-accent tabular-nums">
                    <SimulationIcon className="size-5 shrink-0 text-muted transition-colors duration-150 group-hover:text-accent" />
                    {formatMoney(item.principal)}
                  </span>
                  <span className="text-sm text-muted">
                    {formatIsoDate(item.investmentDate)} a{' '}
                    {formatIsoDate(item.maturityDate)}
                    {item.result
                      ? ` · líquido ${formatMoney(item.result.netBalance)}`
                      : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {state.status === 'ready' && state.total > 0 && (
        <Link
          to={`/simulacoes?offerId=${offerId}`}
          className={`${quietButton} group gap-1 justify-self-start`}
        >
          Ver todas ({state.total})
          <ArrowRightIcon className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      )}
    </section>
  );
}

export function OfferDetailsPage() {
  const { offerId = '' } = useParams();
  const details = useOfferDetails(offerId);
  const { state, listSearch, duplicate, remove, simulations } = details;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const affected =
    simulations.state.status === 'ready' ? simulations.state.total : null;

  return (
    <section aria-labelledby="offer-title" className="grid gap-6">
      <title>
        {state.status === 'ready'
          ? `${offerTermsLabel(state.offer)} | InvestFlow`
          : 'Oferta | InvestFlow'}
      </title>
      <PageLabel icon={OfferIcon}>
        <Link to={`/ofertas${listSearch}`} className="text-accent">
          Ofertas
        </Link>
      </PageLabel>
      {state.status === 'loading' && (
        <div className={surface}>
          <ListSkeleton label="Carregando oferta…" />
          <span id="offer-title" hidden>
            Oferta
          </span>
        </div>
      )}
      {state.status === 'missing' && (
        <div className="grid justify-items-start gap-4">
          <h1 id="offer-title" className="m-0 text-xl font-semibold">
            Oferta não encontrada
          </h1>
          <p className="m-0 text-muted">
            Ela pode ter sido excluída. As outras ofertas continuam na lista.
          </p>
          <Link to={`/ofertas${listSearch}`} className={secondaryButton}>
            Ver ofertas
          </Link>
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-4">
          <h1 id="offer-title" className="m-0 text-xl font-semibold">
            Não foi possível abrir a oferta
          </h1>
          <button
            type="button"
            className={secondaryButton}
            disabled={state.retrying}
            onClick={details.retry}
          >
            {state.retrying ? 'Tentando…' : 'Tentar novamente'}
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <PageTitle
              id="offer-title"
              icon={OfferIcon}
              subtitle={issuerAndNameLabel(state.offer)}
            >
              {offerTermsLabel(state.offer)}
            </PageTitle>
            <div className="flex flex-wrap gap-2">
              {state.offer.origin === 'OWN' && (
                <Link to={`editar${listSearch}`} className={primaryButton}>
                  <PencilIcon className="size-4 shrink-0" />
                  Editar
                </Link>
              )}
              <button
                type="button"
                className={secondaryButton}
                disabled={duplicate.pending}
                onClick={duplicate.run}
              >
                {duplicate.pending ? (
                  <SpinningRefreshIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4 shrink-0" />
                )}
                {duplicate.pending ? 'Duplicando…' : 'Duplicar'}
              </button>
              {state.offer.origin === 'OWN' && (
                <button
                  type="button"
                  className={`${quietButton} gap-2 text-error`}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <TrashIcon className="size-4 shrink-0" />
                  Excluir
                </button>
              )}
            </div>
          </header>
          {duplicate.failed && (
            <p role="alert" className="m-0 text-sm text-error">
              Não foi possível duplicar. Tente novamente.
            </p>
          )}
          {state.offer.origin === 'SYSTEM' && (
            <p className="m-0 max-w-prose text-muted">
              Ofertas do sistema não podem ser alteradas. Duplique para ter uma
              cópia sua e editá-la.
            </p>
          )}
          <OfferTerms offer={state.offer} />
          <OfferSimulations
            offerId={offerId}
            state={simulations.state}
            onRetry={simulations.retry}
          />
        </>
      )}
      {confirmingDelete && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            onOpenChange={setConfirmingDelete}
            title="Excluir esta oferta?"
            description={
              <>
                A exclusão é definitiva.{' '}
                {affected === null
                  ? 'As simulações que usam esta oferta ficarão sem oferta (Sem oferta, escolha outra).'
                  : affected === 0
                    ? 'Nenhuma das suas simulações usa esta oferta.'
                    : `${simulationCount(affected)} ${affected === 1 ? 'ficará' : 'ficarão'} sem oferta (Sem oferta, escolha outra).`}{' '}
                Cópias desta oferta não são afetadas.
              </>
            }
            cancelLabel="Cancelar"
            confirmLabel={remove.pending ? 'Excluindo…' : 'Excluir oferta'}
            destructive
            pending={remove.pending}
            error={
              remove.failed
                ? 'Não foi possível excluir. Tente novamente.'
                : undefined
            }
            onConfirm={remove.run}
          />
        </Suspense>
      )}
    </section>
  );
}
