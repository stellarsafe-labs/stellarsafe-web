/**
 * Token amounts are handled as bigint base units (Stellar assets use 7
 * decimals). Never use floating point for money: 0.1 + 0.2 !== 0.3.
 */
export const STELLAR_DECIMALS = 7;

const AMOUNT_RE = /^\d+(\.\d+)?$/;

export class AmountError extends Error {}

/** Parse a human decimal string ("1,250.50") into base units. Throws AmountError. */
export function parseAmount(input: string, decimals = STELLAR_DECIMALS): bigint {
  const clean = input.replace(/[,\s_]/g, "");
  if (!AMOUNT_RE.test(clean)) throw new AmountError("Enter a valid number");
  const [whole, frac = ""] = clean.split(".");
  if (frac.length > decimals) {
    throw new AmountError(`At most ${decimals} decimal places`);
  }
  return BigInt(whole + frac.padEnd(decimals, "0"));
}

/** Non-throwing variant for form validation. */
export function tryParseAmount(input: string, decimals = STELLAR_DECIMALS): bigint | null {
  try {
    return parseAmount(input, decimals);
  } catch {
    return null;
  }
}

interface FormatOptions {
  decimals?: number;
  /** Max fraction digits shown; trailing zeros are trimmed down to minFraction. */
  maxFraction?: number;
  minFraction?: number;
  /** Use thousands separators. */
  grouping?: boolean;
  compact?: boolean;
}

export function formatAmount(units: bigint, opts: FormatOptions = {}): string {
  const { decimals = STELLAR_DECIMALS, maxFraction = 2, minFraction = 0, grouping = true, compact = false } = opts;

  const negative = units < 0n;
  let abs = negative ? -units : units;
  const scale = 10n ** BigInt(decimals);

  if (compact) {
    const whole = abs / scale;
    const tiers: [bigint, string][] = [
      [1_000_000_000n, "B"],
      [1_000_000n, "M"],
      [1_000n, "K"],
    ];
    for (const [div, suffix] of tiers) {
      if (whole >= div) {
        // one decimal of precision, computed in integers
        const tenths = (abs * 10n) / (scale * div);
        const str = `${tenths / 10n}${tenths % 10n === 0n ? "" : `.${tenths % 10n}`}`;
        return `${negative ? "-" : ""}${str}${suffix}`;
      }
    }
  }

  // round half up to maxFraction digits
  const drop = BigInt(decimals - Math.min(maxFraction, decimals));
  if (drop > 0n) {
    const f = 10n ** drop;
    abs = ((abs + f / 2n) / f) * f;
  }

  const whole = (abs / scale).toString();
  let frac = (abs % scale).toString().padStart(decimals, "0").slice(0, maxFraction);
  while (frac.length > minFraction && frac.endsWith("0")) frac = frac.slice(0, -1);

  const wholeFmt = grouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole;
  return `${negative ? "-" : ""}${wholeFmt}${frac ? `.${frac}` : ""}`;
}

/** Convert units to a JS number for charts only — never for arithmetic. */
export function unitsToNumber(units: bigint, decimals = STELLAR_DECIMALS): number {
  return Number(units) / 10 ** decimals;
}

export function toUnits(whole: number | bigint, decimals = STELLAR_DECIMALS): bigint {
  return BigInt(whole) * 10n ** BigInt(decimals);
}

export const minBig = (a: bigint, b: bigint) => (a < b ? a : b);
export const maxBig = (a: bigint, b: bigint) => (a > b ? a : b);
