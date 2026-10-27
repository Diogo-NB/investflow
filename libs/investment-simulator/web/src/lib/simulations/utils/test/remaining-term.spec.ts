import type { RemainingTerm } from '../../models/simulation.types';
import { describeRemainingTerm } from '../remaining-term';

const dates = { investmentDate: '2026-11-03', maturityDate: '2028-10-14' };

const term = (overrides: Partial<RemainingTerm>): RemainingTerm => ({
  phase: 'RUNNING',
  calendarDays: 10,
  years: 0,
  months: 0,
  days: 0,
  ...overrides,
});

describe('describeRemainingTerm', () => {
  it('states the maturity and the time left, dropping zero parts', () => {
    expect(
      describeRemainingTerm(term({ years: 1, months: 11, days: 28 }), dates),
    ).toBe('Vence em 14/10/2028 · faltam 1 ano, 11 meses e 28 dias');
    expect(describeRemainingTerm(term({ years: 2, days: 1 }), dates)).toBe(
      'Vence em 14/10/2028 · faltam 2 anos e 1 dia',
    );
    expect(describeRemainingTerm(term({ months: 1 }), dates)).toBe(
      'Vence em 14/10/2028 · falta 1 mês',
    );
    expect(describeRemainingTerm(term({ days: 5 }), dates)).toBe(
      'Vence em 14/10/2028 · faltam 5 dias',
    );
  });

  it('states the whole term before the investment date', () => {
    expect(
      describeRemainingTerm(term({ phase: 'NOT_STARTED', years: 2 }), dates),
    ).toBe('Começa em 03/11/2026 · prazo de 2 anos');
  });

  it('says when it matures today or has matured', () => {
    expect(describeRemainingTerm(term({ calendarDays: 0 }), dates)).toBe(
      'Vence hoje',
    );
    expect(
      describeRemainingTerm(term({ phase: 'MATURED', calendarDays: 0 }), dates),
    ).toBe('Venceu em 14/10/2028');
  });
});
