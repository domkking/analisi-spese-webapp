/**
 * Importi in denaro: SEMPRE interi in centesimi (mai float).
 * Le divisioni passano da BigInt con arrotondamento «mezzo lontano da zero».
 */
import { LIMITS } from "./config.ts";
import { ValidationError } from "./errors.ts";

const DECIMAL_RE = /^-?\d{1,10}(\.\d{1,2})?$/;

function decimalToCents(text: string): number {
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const [integer = "0", fraction = ""] = body.split(".");
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, "0"));
  return negative && cents !== 0 ? -cents : cents;
}

function checkRange(cents: number): number {
  if (Math.abs(cents) > LIMITS.maxAmountCents) throw new ValidationError("Importo troppo grande.");
  return cents;
}

/**
 * Interpreta un importo digitato (es. «1.234,56», «12,5», «€ 7»).
 * Formato rigido: niente notazione scientifica, NaN/Infinity o più di 2 decimali.
 */
export function parseAmount(text: string): number {
  let cleaned = text.replaceAll("€", "").replace(/[\s\u00a0]/g, "");
  if (cleaned.includes(",")) cleaned = cleaned.replaceAll(".", "").replace(",", ".");
  if (!DECIMAL_RE.test(cleaned)) {
    throw new ValidationError("Importo non valido: usa solo cifre, con al massimo due decimali (es. 1.234,56).");
  }
  return checkRange(decimalToCents(cleaned));
}

/** Converte un valore letto da un file JSON (stringa «12.50» o numero) in centesimi. */
export function jsonToCents(value: unknown): number {
  if (typeof value === "string") {
    if (!DECIMAL_RE.test(value)) throw new ValidationError("Importo nel file dati non valido.");
    return checkRange(decimalToCents(value));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Math.abs(value) > LIMITS.maxAmountCents / 100) throw new ValidationError("Importo nel file dati fuori intervallo.");
    return checkRange(decimalToCents(value.toFixed(2)));
  }
  throw new ValidationError("Importo nel file dati non valido.");
}

/** Importo come stringa decimale per il file JSON («12.50»). */
export function centsToDecimalString(cents: number): string {
  const abs = Math.abs(cents);
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return cents < 0 ? `-${text}` : text;
}

/** Divisione intera con arrotondamento mezzo-lontano-da-zero (come ROUND_HALF_UP di Decimal). */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new ValidationError("Divisione per zero.");
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const twiceRemainder = (remainder < 0n ? -remainder : remainder) * 2n;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  if (twiceRemainder >= absDenominator) {
    quotient += (numerator < 0n) !== (denominator < 0n) ? -1n : 1n;
  }
  return quotient;
}
