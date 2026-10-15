/**
 * Periodi contabili: dal giorno dello stipendio al giorno prima del successivo.
 * Un periodo è identificato dalla chiave «AAAA-MM» del mese in cui inizia
 * (es. «2026-01» = dal 15/01/2026 al 14/02/2026 con stipendio il 15).
 * Le date sono stringhe ISO e i calcoli usano solo UTC: nessun problema di fuso orario.
 */
import { LIMITS } from "./config.ts";

const DAY_MS = 86_400_000;
const pad = (n: number, width: number): string => String(n).padStart(width, "0");

function toUtcMs(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

export function addDays(iso: string, days: number): string {
  return fromUtcMs(toUtcMs(iso) + days * DAY_MS);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcMs(toIso) - toUtcMs(fromIso)) / DAY_MS);
}

/** Data odierna (fuso del dispositivo) in formato ISO. */
export function todayIso(now: Date): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}

function splitKey(key: string): [number, number] {
  return [Number(key.slice(0, 4)), Number(key.slice(5, 7))];
}

export function prevKey(key: string): string {
  const [year, month] = splitKey(key);
  return month === 1 ? `${pad(year - 1, 4)}-12` : `${pad(year, 4)}-${pad(month - 1, 2)}`;
}

export function nextKey(key: string): string {
  const [year, month] = splitKey(key);
  return month === 12 ? `${pad(year + 1, 4)}-01` : `${pad(year, 4)}-${pad(month + 1, 2)}`;
}

export function keyInRange(key: string): boolean {
  const [year] = splitKey(key);
  return year >= LIMITS.minYear && year <= LIMITS.maxYear;
}

export function keyForDate(iso: string, payDay: number): string {
  const key = iso.slice(0, 7);
  return Number(iso.slice(8, 10)) >= payDay ? key : prevKey(key);
}

/** Primo e ultimo giorno (inclusi) del periodo. */
export function periodBounds(key: string, payDay: number): { start: string; end: string } {
  const start = `${key}-${pad(payDay, 2)}`;
  const end = addDays(`${nextKey(key)}-${pad(payDay, 2)}`, -1);
  return { start, end };
}
