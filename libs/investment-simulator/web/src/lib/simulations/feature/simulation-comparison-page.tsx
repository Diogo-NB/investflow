import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import {
  formatMoney,
  formatPercentagePoints,
  formatReturnPercent,
} from '../../decimals/format-decimal';
import { REDEMPTION_LABELS } from '../../offers/models/offer-terms';
import { ListSkeleton } from '../../ui/list-skeleton';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import {
  AlertTriangleIcon,
  InfoIcon,
  PlusIcon,
  SimulationIcon,
  StarIcon,
  XIcon,
} from '../../ui/icons';
import { quietButton, secondaryButton, surface } from '../../ui/styles';
import type {
  ComparedSimulation,
  SimulationComparison,
} from '../models/simulation.types';
import { CalculationStatusTag, TAG_BASE } from '../ui/calculation-status-tag';
import {
  COMPARISON_ROW_GROUPS,
  NET_ANNUAL_RETURN_ROW,
  onlyDifferences,
  rankedOrder,
  rankingMark,
  type ComparisonRow,
  type ComparisonRowGroup,
} from '../utils/comparison-rows';
import { useSimulationComparison } from './use-simulation-comparison';

const LIST = '/simulacoes';

const names = (simulations: readonly ComparedSimulation[]) => {
  const all = simulations.map(({ offer }) => offer.name);
  const last = all.pop();
  return all.length ? `${all.join(', ')} e ${last}` : (last ?? '');
};

function Verdict({
  comparison,
}: {
  readonly comparison: SimulationComparison;
}) {
  const ranked = rankedOrder(comparison.simulations).filter(
    ({ standing }) => standing,
  );
  const leaders = ranked.filter(({ standing }) => standing?.isLeader);
  const others = ranked.filter(({ standing }) => !standing?.isLeader);
  const unranked = comparison.simulations.filter(({ standing }) => !standing);
  const leader = leaders[0];

  return (
    <section
      aria-labelledby="comparison-verdict"
      className="grid gap-3 rounded-surface border border-accent/30 bg-accent-soft px-5 py-4"
    >
      {leader?.result ? (
        <>
          <h2
            id="comparison-verdict"
            className="m-0 flex items-start gap-2 text-lg font-semibold text-accent"
          >
            <StarIcon className="mt-0.5 size-5 shrink-0" />
            <span>
              {ranked.length === 1
                ? `Só ${leader.offer.name} tem resultado: `
                : leaders.length === 1
                  ? `${leader.offer.name} rende mais: `
                  : `${names(leaders)} empatam no maior rendimento: `}
              <span className="tabular-nums">
                {formatReturnPercent(leader.result.net.rateOfReturn.annual)} ao
                ano, líquido
              </span>
            </span>
          </h2>
          {others.length > 0 && (
            <ul className="m-0 grid list-none gap-1 p-0">
              {others.map(({ simulation, offer, standing }) =>
                standing ? (
                  <li key={simulation.id} className="tabular-nums">
                    {formatPercentagePoints(standing.netAnnualReturnGap)} ao ano
                    a mais que {offer.name}
                    {standing.netBalanceGap !== null &&
                      ` · ${formatMoney(standing.netBalanceGap)} a mais no vencimento`}
                  </li>
                ) : null,
              )}
            </ul>
          )}
          {ranked.length > 1 && (
            <p className="m-0 flex items-start gap-2 text-sm text-muted">
              <InfoIcon className="mt-px size-4 shrink-0" />
              {comparison.areAmountsComparable
                ? 'Mesmo valor aplicado e mesmo prazo: os montantes líquidos também se comparam diretamente.'
                : 'Valores ou prazos diferentes: compare pela rentabilidade líquida ao ano, não pelo montante.'}
            </p>
          )}
        </>
      ) : (
        <h2 id="comparison-verdict" className="m-0 text-lg font-semibold">
          Nenhuma simulação tem resultado ainda
        </h2>
      )}
      {unranked.length > 0 && (
        <p className="m-0 text-sm text-muted">
          Sem resultado para comparar: {names(unranked)}.
        </p>
      )}
      {!comparison.isSettled && leader && (
        <p className="m-0 flex items-start gap-2 text-sm text-warning">
          <AlertTriangleIcon className="mt-px size-4 shrink-0" />
          Comparação provisória: há simulações calculando, que requerem ação ou
          com resultado anterior às últimas alterações.
        </p>
      )}
    </section>
  );
}

function RankingMark({
  row,
  simulation,
  comparison,
}: {
  readonly row: ComparisonRow;
  readonly simulation: ComparedSimulation;
  readonly comparison: SimulationComparison;
}) {
  const mark = rankingMark(row, simulation, comparison);
  if (!mark) return null;
  return mark.best ? (
    <span className={`${TAG_BASE} border-accent/30 bg-accent-soft text-accent`}>
      <StarIcon className="size-4 shrink-0" />
      Melhor
    </span>
  ) : (
    <span className="text-sm text-muted">{mark.gap}</span>
  );
}

function SimulationLink({
  simulation,
  search,
}: {
  readonly simulation: ComparedSimulation;
  readonly search: string;
}) {
  return (
    <Link
      to={{ pathname: `${LIST}/${simulation.simulation.id}`, search }}
      className="font-medium text-accent underline-offset-4 hover:underline"
    >
      {simulation.offer.name}
    </Link>
  );
}

function RemoveButton({
  simulation,
  onRemove,
}: {
  readonly simulation: ComparedSimulation;
  readonly onRemove: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`${quietButton} min-w-11 px-0`}
      aria-label={`Remover ${simulation.offer.name} da comparação`}
      onClick={() => onRemove(simulation.simulation.id)}
    >
      <XIcon className="size-5" />
    </button>
  );
}

function SimulationStatus({
  simulation,
}: {
  readonly simulation: ComparedSimulation;
}) {
  if (simulation.isSettled) return null;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <CalculationStatusTag
        status={simulation.calculation.status}
        outdated={simulation.result?.outdated ?? false}
      />
      {simulation.result && (
        <span className="text-sm text-muted">Resultado anterior</span>
      )}
    </span>
  );
}

interface ComparisonViewProps {
  readonly comparison: SimulationComparison;
  readonly groups: readonly ComparisonRowGroup[];
  readonly search: string;
  readonly onRemove: (id: string) => void;
}

// Columns keep the selection order, so they don't move while results arrive.
function ComparisonTable({
  comparison,
  groups,
  search,
  onRemove,
}: ComparisonViewProps) {
  const { simulations } = comparison;
  return (
    <div className={`${surface} hidden overflow-x-auto lg:block`}>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Simulações comparadas</caption>
        <thead>
          <tr className="border-b border-border align-top">
            <td className="sticky left-0 w-52 min-w-52 bg-surface" />
            {simulations.map((simulation) => (
              <th
                key={simulation.simulation.id}
                scope="col"
                className="min-w-52 px-4 py-3 font-normal"
              >
                <span className="grid justify-items-start gap-2">
                  <span className="flex w-full items-start justify-between gap-2">
                    <span>
                      {simulation.standing && (
                        <span className="mr-2 text-sm font-semibold text-muted">
                          {simulation.standing.position}º
                        </span>
                      )}
                      <SimulationLink simulation={simulation} search={search} />
                    </span>
                    <RemoveButton simulation={simulation} onRemove={onRemove} />
                  </span>
                  <SimulationStatus simulation={simulation} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.title}>
            <tr className="border-b border-border bg-bg">
              <th
                scope="colgroup"
                colSpan={simulations.length + 1}
                className="sticky left-0 px-4 py-2 text-sm font-semibold text-muted"
              >
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.label} className="border-b border-border">
                <th
                  scope="row"
                  className="sticky left-0 bg-surface px-4 py-3 text-sm font-medium text-muted"
                >
                  {row.label}
                </th>
                {simulations.map((simulation) => (
                  <td
                    key={simulation.simulation.id}
                    className="px-4 py-3 align-top tabular-nums"
                  >
                    <span className="grid justify-items-start gap-1">
                      {row.value(simulation)}
                      <RankingMark
                        row={row}
                        simulation={simulation}
                        comparison={comparison}
                      />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

// Ranked, since a phone shows one simulation at a time.
function ComparisonCards({
  comparison,
  groups,
  search,
  onRemove,
}: ComparisonViewProps) {
  return (
    <ol className="m-0 grid list-none gap-4 p-0 lg:hidden">
      {rankedOrder(comparison.simulations).map((simulation) => {
        const { offer, result, standing } = simulation;
        return (
          <li
            key={simulation.simulation.id}
            className={`${surface} grid gap-3 p-4`}
          >
            <div className="flex items-start justify-between gap-2">
              <span>
                {standing && (
                  <span className="mr-2 text-sm font-semibold text-muted">
                    {standing.position}º
                  </span>
                )}
                <SimulationLink simulation={simulation} search={search} />
                <span className="block text-sm text-muted">
                  {offer.titleType} · {offer.issuerName ?? 'Sem emissor'}
                </span>
              </span>
              <RemoveButton simulation={simulation} onRemove={onRemove} />
            </div>
            <SimulationStatus simulation={simulation} />
            {result ? (
              <div className="grid gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold tabular-nums">
                    {formatReturnPercent(result.net.rateOfReturn.annual)} ao
                    ano, líquido
                  </span>
                  <RankingMark
                    row={NET_ANNUAL_RETURN_ROW}
                    simulation={simulation}
                    comparison={comparison}
                  />
                </span>
                <span className="text-sm text-muted tabular-nums">
                  {formatMoney(result.net.finalBalance)} no vencimento ·{' '}
                  {result.taxes.incomeTax.rate === null
                    ? 'IR isento'
                    : 'Com IR'}{' '}
                  · Liquidez{' '}
                  {REDEMPTION_LABELS[offer.redemptionTerms.kind].toLowerCase()}
                </span>
              </div>
            ) : (
              <p className="m-0 text-sm text-muted">Sem resultado ainda.</p>
            )}
            <details className="group">
              <summary className={`${quietButton} -ml-3 w-fit list-none`}>
                Detalhes
              </summary>
              <div className="grid gap-4 pt-2">
                {groups.map((group) => (
                  <div key={group.title} className="grid gap-2">
                    <h3 className="m-0 text-sm font-semibold text-muted">
                      {group.title}
                    </h3>
                    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                      {group.rows.map((row) => (
                        <div key={row.label} className="contents">
                          <dt className="text-muted">{row.label}</dt>
                          <dd className="m-0 text-right tabular-nums">
                            {row.value(simulation)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

export function SimulationComparisonPage() {
  const page = useSimulationComparison();
  const { state, selectionSearch } = page;
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const groups =
    state.status === 'ready' && differencesOnly
      ? onlyDifferences(COMPARISON_ROW_GROUPS, state.comparison.simulations)
      : COMPARISON_ROW_GROUPS;

  if (page.listRedirect !== null) {
    return (
      <Navigate replace to={{ pathname: LIST, search: page.listRedirect }} />
    );
  }
  if (page.correctedSearch !== null) {
    return <Navigate replace to={{ search: page.correctedSearch }} />;
  }

  return (
    <section aria-labelledby="comparison-title" className="grid gap-6">
      <title>Comparar simulações | InvestFlow</title>
      <PageLabel icon={SimulationIcon}>
        <Link
          to={{ pathname: LIST, search: selectionSearch }}
          className="text-accent"
        >
          Simulações
        </Link>
      </PageLabel>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle
          id="comparison-title"
          icon={SimulationIcon}
          subtitle="Lado a lado, pela rentabilidade líquida ao ano: a medida justa entre prazos diferentes e entre títulos com e sem imposto de renda."
        >
          Comparar simulações
        </PageTitle>
        {page.canAdd && (
          <Link
            to={{ pathname: LIST, search: selectionSearch }}
            className={secondaryButton}
          >
            <PlusIcon className="size-5 shrink-0" />
            Adicionar
          </Link>
        )}
      </header>

      {state.status === 'loading' && (
        <div className={surface}>
          <ListSkeleton label="Carregando comparação…" />
        </div>
      )}
      {state.status === 'missing' && (
        <div className="grid justify-items-start gap-4">
          <p className="m-0">
            Uma das simulações não foi encontrada. Ela pode ter sido excluída.
          </p>
          <Link
            to={{ pathname: LIST, search: selectionSearch }}
            className={secondaryButton}
          >
            Escolher as simulações
          </Link>
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-4">
          <p className="m-0">Não foi possível carregar a comparação.</p>
          <button
            type="button"
            className={secondaryButton}
            disabled={state.retrying}
            onClick={page.retry}
          >
            {state.retrying ? 'Tentando…' : 'Tentar novamente'}
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <div
          aria-busy={state.updating}
          className={`grid gap-6 transition-opacity duration-150 ${state.updating ? 'opacity-50' : ''}`}
        >
          <div aria-live="polite">
            <Verdict comparison={state.comparison} />
          </div>
          <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-accent"
              checked={differencesOnly}
              onChange={(event) => setDifferencesOnly(event.target.checked)}
            />
            Mostrar só diferenças
          </label>
          <ComparisonTable
            comparison={state.comparison}
            groups={groups}
            search={selectionSearch}
            onRemove={page.remove}
          />
          <ComparisonCards
            comparison={state.comparison}
            groups={groups}
            search={selectionSearch}
            onRemove={page.remove}
          />
        </div>
      )}
    </section>
  );
}
