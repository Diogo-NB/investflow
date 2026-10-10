// Civil dates travel as "YYYY-MM-DD" strings and never become instants.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const BRAZILIAN_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const SAO_PAULO = 'America/Sao_Paulo';

function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ];
}

function isValidParts(year: number, month: number, day: number): boolean {
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  return Boolean(
    match && isValidParts(Number(match[1]), Number(match[2]), Number(match[3])),
  );
}

/** "31/12/2028" → "2028-12-31", or null when it is not a real date. */
export function parseBrazilianDate(text: string): string | null {
  const match = BRAZILIAN_DATE.exec(text.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  return isValidParts(Number(year), Number(month), Number(day))
    ? `${year}-${month}-${day}`
    : null;
}

/** The civil day before an ISO date, computed without instants. */
export function previousDay(iso: string): string {
  let [year, month, day] = iso.split('-').map(Number);
  day -= 1;
  if (day === 0) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    day = daysInMonth(year, month);
  }
  const pad = (value: number, length = 2) =>
    String(value).padStart(length, '0');
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function formatMonth(isoMonth: string): string {
  const [year, month] = isoMonth.split('-');
  return `${MONTH_NAMES[Number(month) - 1]} de ${year}`;
}

export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/** Today's civil date in São Paulo, where the investor lives. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO }).format(now);
}

const instantFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO,
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatInstant(isoInstant: string): string {
  return instantFormat.format(new Date(isoInstant));
}

// The calendar widget works with local Date objects; these stay inside it.
export function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function localDateToIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
