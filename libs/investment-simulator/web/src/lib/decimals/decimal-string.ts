// Exact decimal strings: financial values never pass through `Number`.

const DECIMAL = /^(\d+)(?:\.(\d+))?$/;
// Storage is Decimal(65,30): 35 integer and 30 fractional digits.
const MAX_INTEGER_DIGITS = 35;
const MAX_FRACTION_DIGITS = 30;

function normalize(integer: string, fraction: string): string {
  const int = integer.replace(/^0+(?=\d)/, '');
  const frac = fraction.replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

/**
 * Parses a Brazilian-formatted amount ("10.000,50", "10000,5", "1000.5") into
 * a canonical decimal string ("10000.5"). Returns null for anything else.
 */
export function parseBrazilianDecimal(text: string): string | null {
  const value = text.replace(/\s|R\$/g, '');
  let integer: string;
  let fraction = '';
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value) || /^\d+(,\d+)?$/.test(value)) {
    [integer, fraction = ''] = value.replace(/\./g, '').split(',');
  } else if (/^\d+\.\d+$/.test(value)) {
    [integer, fraction] = value.split('.');
  } else {
    return null;
  }
  return normalize(integer, fraction);
}

/** Moves the decimal point: `shiftDecimal('1.1', 2)` is `'110'`. */
export function shiftDecimal(decimal: string, places: number): string {
  const match = DECIMAL.exec(decimal);
  if (!match) throw new Error(`Not a decimal string: ${decimal}`);
  const [, integer, fraction = ''] = match;
  const digits = integer + fraction;
  const point = integer.length + places;
  const padded =
    point < 0 ? '0'.repeat(-point) + digits : digits.padEnd(point, '0');
  const at = Math.max(point, 0);
  return normalize(padded.slice(0, at) || '0', padded.slice(at));
}

export function isPositiveDecimal(decimal: string): boolean {
  return /[1-9]/.test(decimal);
}

export function fitsDecimalStorage(decimal: string): boolean {
  const [integer, fraction = ''] = decimal.split('.');
  return (
    integer.length <= MAX_INTEGER_DIGITS &&
    fraction.length <= MAX_FRACTION_DIGITS
  );
}

export function toBrazilianInput(decimal: string): string {
  return decimal.replace('.', ',');
}
