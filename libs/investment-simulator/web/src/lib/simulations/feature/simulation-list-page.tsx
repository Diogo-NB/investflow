import { Link, Navigate, useSearchParams } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import { formatMoney } from '../../decimals/format-decimal';
import { remunerationLabel } from '../../offers/models/offer-terms';
import { PageLabel } from '../../ui/page-label';
import {
  primaryButton,
  quietButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import type { SimulationListItem } from '../models/simulation.types';
import { useSimulationList } from './use-simulation-list';

function searchWithPage(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page === 1) next.delete('page');
  else next.set('page', String(page));
  const search = next.toString();
  return search ? `?${search}` : '';
}

function origin(item: SimulationListItem): string {
  return item.fromCatalogOffer
    ? 'Da oferta do catálogo'
    : 'Termos personalizados';
}

function NetResult({ item }: { readonly item: SimulationListItem }) {
  return (
    <span className="grid justify-items-end gap-0.5">
      <span className="font-medium tabular-nums">
        {formatMoney(item.latestCalculation.netBalance)}
      </span>
      {item.latestCalculation.outdated && (
        <span className="text-sm text-warning">Desatualizado</span>
      )}
    </span>
  );
}

function SimulationTable({
  items,
}: {
  readonly items: readonly SimulationListItem[];
}) {
  return (
    <table className="hidden w-full border-collapse text-left lg:table">
      <caption className="sr-only">Suas simulações</caption>
      <thead>
        <tr className="border-b border-border text-sm text-muted">
          <th scope="col" className="px-4 py-3 font-medium">
            Emissor
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            Remuneração
          </th>
          <th scope="col" className="px-4 py-3 text-right font-medium">
            Valor aplicado
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            Período
          </th>
          <th scope="col" className="px-4 py-3 text-right font-medium">
            Líquido no vencimento
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          // The issuer link stretches over the row, so the whole row opens the
          // simulation while staying a single link for keyboards and readers.
          <tr
            key={item.id}
            className="group relative cursor-pointer border-b border-border last:border-b-0 hover:bg-accent-soft"
          >
            <td className="px-4 py-3">
              <Link
                to={item.id}
                className="font-medium text-accent underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
              >
                {item.issuerName ?? 'Sem emissor'}
              </Link>
              <span className="block text-sm text-muted">{origin(item)}</span>
            </td>
            <td className="px-4 py-3">
              {item.titleType} {remunerationLabel(item.remunerationTerms)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatMoney(item.principal)}
            </td>
            <td className="px-4 py-3 tabular-nums">
              {formatIsoDate(item.investmentDate)} a{' '}
              {formatIsoDate(item.maturityDate)}
            </td>
            <td className="px-4 py-3 text-right">
              <NetResult item={item} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SimulationRows({
  items,
}: {
  readonly items: readonly SimulationListItem[];
}) {
  return (
    <ul className="m-0 grid list-none p-0 lg:hidden">
      {items.map((item) => (
        <li key={item.id} className="border-b border-border last:border-b-0">
          <Link
            to={item.id}
            className="grid gap-2 p-4 text-fg no-underline hover:bg-accent-soft"
          >
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-accent">{item.issuerName ?? 'Sem emissor'}</span>
              <NetResult item={item} />
            </span>
            <span className="text-sm text-muted">
              {item.titleType} {remunerationLabel(item.remunerationTerms)} ·{' '}
              {formatMoney(item.principal)} ·{' '}
              {formatIsoDate(item.investmentDate)} a{' '}
              {formatIsoDate(item.maturityDate)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SimulationListPage() {
  const { page, state, correctedPage, retry } = useSimulationList();
  const [searchParams] = useSearchParams();

  if (correctedPage !== null) {
    return (
      <Navigate
        replace
        to={{ search: searchWithPage(searchParams, correctedPage) }}
      />
    );
  }

  return (
    <section aria-labelledby="simulations-title" className="grid gap-6">
      <title>Simulações | InvestFlow</title>
      <PageLabel>Simulações</PageLabel>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-prose">
          <h1
            id="simulations-title"
            className="m-0 text-xl leading-tight font-semibold sm:text-2xl"
          >
            Simulações
          </h1>
          <p className="mt-2 mb-0 text-muted">
            Compare quanto cada CDB rende líquido no vencimento.
          </p>
        </div>
        <Link to="nova" className={primaryButton}>
          Nova simulação
        </Link>
      </header>

      <div
        className={surface}
        aria-busy={
          state.status === 'loading' ||
          (state.status === 'ready' && state.updating)
        }
      >
        {state.status === 'loading' && (
          <p role="status" className="m-0 p-6 text-muted">
            Carregando simulações…
          </p>
        )}
        {state.status === 'error' && (
          <div role="alert" className="grid justify-items-start gap-4 p-6">
            <p className="m-0">Não foi possível carregar suas simulações.</p>
            <button
              type="button"
              className={secondaryButton}
              disabled={state.retrying}
              onClick={retry}
            >
              {state.retrying ? 'Tentando…' : 'Tentar novamente'}
            </button>
          </div>
        )}
        {state.status === 'ready' && state.items.length === 0 && (
          <div className="grid justify-items-start gap-4 p-6">
            <p className="m-0 max-w-prose">
              Você ainda não tem simulações. Informe o valor, as datas e os
              termos de um CDB para ver o resultado líquido no vencimento.
            </p>
            <Link to="nova" className={secondaryButton}>
              Criar a primeira simulação
            </Link>
          </div>
        )}
        {state.status === 'ready' && state.items.length > 0 && (
          <>
            <SimulationTable items={state.items} />
            <SimulationRows items={state.items} />
          </>
        )}
      </div>

      {state.status === 'ready' && state.lastPage > 1 && (
        <nav
          aria-label="Páginas de simulações"
          className="flex flex-wrap items-center gap-2"
        >
          {page > 1 ? (
            <Link
              to={{ search: searchWithPage(searchParams, page - 1) }}
              className={quietButton}
            >
              ← Anterior
            </Link>
          ) : null}
          <span className="px-2 text-sm text-muted" aria-live="polite">
            Página {page} de {state.lastPage}
          </span>
          {page < state.lastPage ? (
            <Link
              to={{ search: searchWithPage(searchParams, page + 1) }}
              className={quietButton}
            >
              Próxima →
            </Link>
          ) : null}
        </nav>
      )}
    </section>
  );
}
