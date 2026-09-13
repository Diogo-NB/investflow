import { UtcInstant } from '@investflow/shared-domain';

const PT_BR_LOCALE = 'pt-BR';

export function formatUtcInstantDatePtBr(
  instant: UtcInstant,
  timeZone: string,
): string {
  const parts = getPtBrParts(instant, timeZone, false);
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatUtcInstantDateTimePtBr(
  instant: UtcInstant,
  timeZone: string,
): string {
  const parts = getPtBrParts(instant, timeZone, true);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

interface PtBrDateParts {
  readonly day: string;
  readonly month: string;
  readonly year: string;
  readonly hour: string;
  readonly minute: string;
  readonly second: string;
}

function getPtBrParts(
  instant: UtcInstant,
  timeZone: string,
  includeTime: boolean,
): PtBrDateParts {
  const formatter = new Intl.DateTimeFormat(PT_BR_LOCALE, {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: includeTime ? '2-digit' : undefined,
    minute: includeTime ? '2-digit' : undefined,
    second: includeTime ? '2-digit' : undefined,
    hourCycle: 'h23',
  });
  const values = new Map(
    formatter
      .formatToParts(instant.date)
      .map((part) => [part.type, part.value]),
  );

  return {
    day: requiredPart(values, 'day'),
    month: requiredPart(values, 'month'),
    year: requiredPart(values, 'year'),
    hour: includeTime ? requiredPart(values, 'hour') : '',
    minute: includeTime ? requiredPart(values, 'minute') : '',
    second: includeTime ? requiredPart(values, 'second') : '',
  };
}

function requiredPart(
  values: ReadonlyMap<string, string>,
  part: string,
): string {
  const value = values.get(part);
  if (value === undefined) {
    throw new Error(`Intl.DateTimeFormat did not produce a ${part} part`);
  }

  return value;
}
