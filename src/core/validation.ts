/** Validazione e sanificazione dell'input (utente e file importati). */
import { LIMITS } from "./config.ts";
import { ValidationError } from "./errors.ts";

const KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Rimuove caratteri di controllo/formattazione Unicode, normalizza gli spazi, verifica la lunghezza. */
export function cleanText(value: unknown, field: string, maxLength: number, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > 10_000) {
    throw new ValidationError(`${field}: valore non valido.`);
  }
  const text = value.replace(/\p{C}/gu, " ").split(/\s+/).filter(Boolean).join(" ");
  if (text === "" && !allowEmpty) throw new ValidationError(`${field}: campo obbligatorio.`);
  if ([...text].length > maxLength) throw new ValidationError(`${field}: massimo ${maxLength} caratteri.`);
  return text;
}

/** Data ISO reale (es. rifiuta 2026-02-31) entro l'intervallo supportato. */
export function parseIsoDate(value: unknown): string {
  const match = typeof value === "string" ? ISO_DATE_RE.exec(value) : null;
  if (!match) throw new ValidationError("Data non valida.");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < LIMITS.minYear || year > LIMITS.maxYear) {
    throw new ValidationError(`Data fuori intervallo (${LIMITS.minYear}-${LIMITS.maxYear}).`);
  }
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new ValidationError("Data non valida.");
  }
  return value as string;
}

export function parsePayDay(value: unknown): number {
  const text = String(value).trim();
  const day = /^\d{1,2}$/.test(text) ? Number(text) : NaN;
  if (!(day >= 1 && day <= 28)) {
    throw new ValidationError("Il giorno dello stipendio deve essere un numero da 1 a 28.");
  }
  return day;
}

export function validatePeriodKey(value: unknown): string {
  const match = typeof value === "string" ? KEY_RE.exec(value) : null;
  const year = match ? Number(match[1]) : 0;
  if (!match || year < LIMITS.minYear || year > LIMITS.maxYear) throw new ValidationError("Periodo non valido.");
  return value as string;
}

export function isValidId(value: unknown): value is string {
  return typeof value === "string" && ID_RE.test(value);
}
