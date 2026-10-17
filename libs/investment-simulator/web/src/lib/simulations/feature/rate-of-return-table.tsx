import { formatReturnPercent } from '../../decimals/format-decimal';
import type { RemunerationKind } from '../../offers/models/offer-terms';
import type {
  RateOfReturn,
  SimulationResult,
} from '../models/simulation.types';
import { RateOfReturnExplanationDialog } from './rate-of-return-explanation-dialog';

const ROWS: readonly [keyof RateOfReturn, string][] = [
  ['annual', 'Ao ano'],
  ['monthly', 'Ao mês'],
  ['forPeriod', 'No período'],
];

export function RateOfReturnTable({
  result,
  remunerationKind,
}: {
  readonly result: SimulationResult;
  readonly remunerationKind: RemunerationKind;
}) {
  const net = result.net.rateOfReturn;
  const gross = result.gross.rateOfReturn;
  // Without taxes due, as for LCI and LCA, both columns would repeat.
  const same = ROWS.every(([key]) => net[key] === gross[key]);
  const columns: readonly [string, RateOfReturn][] = same
    ? [['Líquida e bruta', net]]
    : [
        ['Líquida', net],
        ['Bruta', gross],
      ];
  return (
    <section aria-labelledby="rate-of-return-title" className="grid gap-2">
      <h3 id="rate-of-return-title" className="m-0 text-base font-semibold">
        Rentabilidade
      </h3>
      <table className="w-full border-collapse text-base tabular-nums">
        <thead>
          <tr className="border-b border-border text-sm text-muted">
            <td />
            {columns.map(([label]) => (
              <th
                key={label}
                scope="col"
                className="py-2 pl-4 text-right font-medium"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([key, label]) => (
            <tr key={key} className="border-b border-border">
              <th scope="row" className="py-2 text-left font-normal text-muted">
                {label}
              </th>
              {columns.map(([column, rates]) => (
                <td key={column} className="py-2 pl-4 text-right">
                  {formatReturnPercent(rates[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {same && (
        <p className="m-0 text-sm text-muted">
          {result.taxes.incomeTax.rate === null
            ? 'Isenta de imposto de renda e sem IOF pelo prazo: a rentabilidade líquida é igual à bruta.'
            : 'Sem tributos no vencimento: a rentabilidade líquida é igual à bruta.'}
        </p>
      )}
      <RateOfReturnExplanationDialog
        result={result}
        remunerationKind={remunerationKind}
      />
    </section>
  );
}
