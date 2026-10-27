import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatIsoDate } from '../../dates/calendar-date';
import {
  formatMoney,
  formatReturnPercent,
} from '../../decimals/format-decimal';
import { remunerationLabel } from '../../offers/models/offer-terms';
import { CompareIcon } from '../../ui/icons';
import { primaryButton, quietButton } from '../../ui/styles';
import { CalculationStatusTag } from '../ui/calculation-status-tag';
import {
  MAX_COMPARED,
  MIN_COMPARED,
} from '../utils/simulation-comparison-search';
import type { SimulationListItem } from '../models/simulation.types';

function NetResult({ item }: { readonly item: SimulationListItem }) {
  return (
    <span className="grid justify-items-end gap-1 text-right">
      {item.result ? (
        <span className="font-medium tabular-nums">
          {formatMoney(item.result.netBalance)}
        </span>
      ) : (
        <span className="text-sm text-muted">Sem resultado</span>
      )}
      <CalculationStatusTag
        status={item.calculationStatus}
        outdated={item.result?.outdated ?? false}
      />
    </span>
  );
}

function NetAnnualReturn({ item }: { readonly item: SimulationListItem }) {
  return item.result ? (
    <>{formatReturnPercent(item.result.netAnnualReturn)} a.a.</>
  ) : (
    <span className="text-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Sem rentabilidade</span>
    </span>
  );
}

export interface Selection {
  readonly selected: readonly string[];
  readonly canSelectMore: boolean;
  readonly onToggle: (id: string) => void;
}

// Above the row's stretched link, so ticking it doesn't open the simulation.
function SelectBox({
  item,
  selection,
}: {
  readonly item: SimulationListItem;
  readonly selection: Selection;
}) {
  const checked = selection.selected.includes(item.id);
  return (
    <label className="relative z-10 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control hover:bg-accent-soft has-disabled:cursor-default has-disabled:hover:bg-transparent">
      <input
        type="checkbox"
        className="size-5 cursor-[inherit] accent-accent"
        checked={checked}
        disabled={!checked && !selection.canSelectMore}
        onChange={() => selection.onToggle(item.id)}
      />
      <span className="sr-only">Comparar {item.offerName}</span>
    </label>
  );
}

interface SimulationListProps {
  readonly items: readonly SimulationListItem[];
  // Carried to each simulation, so its page links back to this list.
  readonly search: string;
  readonly selection: Selection;
  // Above the row's link, like the selection box: in its own last column in
  // the table, at the end of the row in the narrow list.
  readonly rowAction?: (item: SimulationListItem) => ReactNode;
}

export function SimulationTable({
  caption,
  items,
  search,
  selection,
  rowAction,
}: SimulationListProps & { readonly caption: string }) {
  // Fixed widths keep the columns in place as filters and pages change rows.
  return (
    <table className="hidden w-full table-fixed border-collapse text-left xl:table">
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        <col />
        <col className="w-44" />
        <col className="w-40" />
        <col className="w-36" />
        <col className="w-36" />
        <col className="w-40" />
        {rowAction && <col className="w-16" />}
      </colgroup>
      <thead>
        <tr className="border-b border-border text-sm text-muted">
          <th scope="col" className="px-4 py-3 font-medium">
            Oferta
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
            Rentab. líquida
          </th>
          <th scope="col" className="px-4 py-3 text-right font-medium">
            Líquido no vencimento
          </th>
          {rowAction && (
            <th scope="col" className="px-2 py-3">
              <span className="sr-only">Ações</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          // The offer link stretches over the row, so the whole row opens the
          // simulation while staying a single link for keyboards and readers.
          <tr
            key={item.id}
            className="group relative cursor-pointer border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-accent-soft"
          >
            <td className="px-4 py-3">
              <span className="flex items-start gap-3">
                <span className="-my-2.5 -ml-3">
                  <SelectBox item={item} selection={selection} />
                </span>
                <span>
                  <Link
                    to={{ pathname: `/simulacoes/${item.id}`, search }}
                    className="font-medium text-accent underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
                  >
                    {item.offerName}
                  </Link>
                  <span className="block text-sm text-muted">
                    {item.issuerName ?? 'Sem emissor'}
                  </span>
                </span>
              </span>
            </td>
            <td className="px-4 py-3">
              {item.titleType} {remunerationLabel(item.remunerationTerms)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatMoney(item.principal)}
            </td>
            <td className="px-4 py-3 whitespace-nowrap tabular-nums">
              <span className="block">{formatIsoDate(item.investmentDate)}</span>
              <span className="block text-muted">
                a {formatIsoDate(item.maturityDate)}
              </span>
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              <NetAnnualReturn item={item} />
            </td>
            <td className="px-4 py-3 text-right">
              <NetResult item={item} />
            </td>
            {rowAction && (
              <td className="relative z-10 px-2 py-1.5 text-right">
                {rowAction(item)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SimulationRows({
  items,
  search,
  selection,
  rowAction,
}: SimulationListProps) {
  return (
    <ul className="m-0 grid list-none p-0 xl:hidden">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start border-b border-border last:border-b-0"
        >
          <span className="pt-2.5 pl-1">
            <SelectBox item={item} selection={selection} />
          </span>
          <Link
            to={{ pathname: `/simulacoes/${item.id}`, search }}
            className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-4 pr-4 pl-2 text-fg no-underline transition-colors duration-150 hover:bg-accent-soft"
          >
            <span>
              <span className="block font-medium text-accent">
                {item.offerName}
              </span>
              <span className="block text-sm text-muted">
                {item.issuerName ?? 'Sem emissor'}
              </span>
            </span>
            <NetResult item={item} />
            <span className="col-span-2 text-sm text-muted">
              {item.result && (
                <>
                  <span className="font-medium text-fg tabular-nums">
                    {formatReturnPercent(item.result.netAnnualReturn)} a.a.
                    líquido
                  </span>{' '}
                  ·{' '}
                </>
              )}
              {item.titleType} {remunerationLabel(item.remunerationTerms)} ·{' '}
              {formatMoney(item.principal)} ·{' '}
              <span className="whitespace-nowrap tabular-nums">
                {formatIsoDate(item.investmentDate)} a{' '}
                {formatIsoDate(item.maturityDate)}
              </span>
            </span>
          </Link>
          {rowAction && <span className="pt-2.5 pr-1">{rowAction(item)}</span>}
        </li>
      ))}
    </ul>
  );
}

// Stays mounted so its live region announces the first selection.
export function ComparisonBar({
  selected,
  comparisonPath,
  onClear,
}: {
  readonly selected: readonly string[];
  // Null until enough simulations are selected.
  readonly comparisonPath: string | null;
  readonly onClear: () => void;
}) {
  const count = selected.length;
  const full = count >= MAX_COMPARED;
  const hint =
    comparisonPath === null
      ? `Selecione ao menos ${MIN_COMPARED} para comparar.`
      : full
        ? `Máximo de ${MAX_COMPARED}.`
        : null;
  return (
    <div
      aria-live="polite"
      className={count ? 'sticky bottom-4 z-20' : 'sr-only'}
    >
      {count > 0 && (
        <div
          role="region"
          aria-label="Simulações para comparar"
          className="flex flex-wrap items-center justify-between gap-3 rounded-surface border-2 border-accent bg-surface px-4 py-3"
        >
          <p className="m-0">
            <span className="font-medium">
              {count} {count === 1 ? 'selecionada' : 'selecionadas'}
            </span>
            {hint && <span className="text-sm text-muted"> · {hint}</span>}
          </p>
          <div className="flex gap-2">
            <button type="button" className={quietButton} onClick={onClear}>
              Limpar
            </button>
            {comparisonPath === null ? (
              <button type="button" className={primaryButton} disabled>
                <CompareIcon className="size-5 shrink-0" />
                Comparar
              </button>
            ) : (
              <Link to={comparisonPath} className={primaryButton}>
                <CompareIcon className="size-5 shrink-0" />
                Comparar
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
