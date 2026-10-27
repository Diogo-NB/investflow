import { UtcInstant } from '@investflow/shared-domain';
import {
  formatUtcInstantDatePtBr,
  formatUtcInstantDateTimePtBr,
} from '../temporal.formatter';

describe('PT-BR temporal formatters', () => {
  const instant = UtcInstant.ofIso('2026-01-02T03:04:05Z');

  it('formats the calendar date in an explicit timezone', () => {
    expect(formatUtcInstantDatePtBr(instant, 'America/Sao_Paulo')).toBe(
      '02/01/2026',
    );
  });

  it('formats the date and time in an explicit timezone', () => {
    expect(formatUtcInstantDateTimePtBr(instant, 'America/Sao_Paulo')).toBe(
      '02/01/2026 00:04:05',
    );
  });

  it('rejects invalid IANA timezones', () => {
    expect(() => formatUtcInstantDatePtBr(instant, 'Invalid/Timezone')).toThrow(
      RangeError,
    );
  });
});
