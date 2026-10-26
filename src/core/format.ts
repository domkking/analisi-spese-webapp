/** Formattazione italiana, deterministica (non dipende da Intl né dal browser). */

const MONTHS_ABBR = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** 123456 -> «1.234,56 €» */
export function formatEur(cents: number): string {
  const abs = Math.abs(cents);
  const integer = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = cents < 0 ? "-" : "";
  return `${sign}${integer},${String(abs % 100).padStart(2, "0")} €`;
}

/** 123456 -> «1234,56» (per i campi di testo) */
export function formatInput(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** plural(1, "movimento", "movimenti") -> «1 movimento»; plural(3, ...) -> «3 movimenti» */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** 305 -> «30,5 %» */
export function formatPercentTenths(tenths: number): string {
  return `${Math.floor(tenths / 10)},${tenths % 10} %`;
}

/** «2026-10-06» -> «06/10/2026» */
export function formatDateIt(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** «2026-10-15», «2026-11-14» -> «15 ott – 14 nov 2026» */
export function formatPeriodLabel(startIso: string, endIso: string): string {
  const label = (iso: string): string => `${Number(iso.slice(8, 10))} ${MONTHS_ABBR[Number(iso.slice(5, 7)) - 1] ?? ""}`;
  return `${label(startIso)} – ${label(endIso)} ${endIso.slice(0, 4)}`;
}
