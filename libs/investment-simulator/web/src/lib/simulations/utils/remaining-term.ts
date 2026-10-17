import { formatIsoDate } from '../../dates/calendar-date';
import type { RemainingTerm } from '../models/simulation.types';

const UNITS = [
  ['years', 'ano', 'anos'],
  ['months', 'mês', 'meses'],
  ['days', 'dia', 'dias'],
] as const;

function duration(term: RemainingTerm): { text: string; singular: boolean } {
  const parts = UNITS.filter(([key]) => term[key] > 0).map(
    ([key, singular, plural]) =>
      `${term[key]} ${term[key] === 1 ? singular : plural}`,
  );
  const last = parts.pop() ?? '0 dias';
  return {
    text: parts.length ? `${parts.join(', ')} e ${last}` : last,
    singular: parts.length === 0 && last.startsWith('1 '),
  };
}

export function describeRemainingTerm(
  term: RemainingTerm,
  dates: { readonly investmentDate: string; readonly maturityDate: string },
): string {
  const maturity = formatIsoDate(dates.maturityDate);
  switch (term.phase) {
    case 'NOT_STARTED':
      return `Começa em ${formatIsoDate(dates.investmentDate)} · prazo de ${duration(term).text}`;
    case 'RUNNING': {
      if (term.calendarDays === 0) return 'Vence hoje';
      const left = duration(term);
      return `Vence em ${maturity} · ${left.singular ? 'falta' : 'faltam'} ${left.text}`;
    }
    case 'MATURED':
      return `Venceu em ${maturity}`;
  }
}
