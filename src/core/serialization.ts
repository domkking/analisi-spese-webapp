/**
 * Ledger <-> JSON, con validazione rigorosa: il file importato è un dato NON fidato.
 * Il formato è identico a quello dell'app desktop (chiavi italiane, importi come «12.50»),
 * così i backup sono scambiabili tra le due versioni.
 */
import { DEFAULTS, LIMITS, SCHEMA_VERSION } from "./config.ts";
import { ValidationError } from "./errors.ts";
import { createDefaultLedger } from "./ledger.ts";
import type { CategoryBudget, Ledger, Movement, PeriodParams } from "./models.ts";
import { centsToDecimalString, jsonToCents } from "./money.ts";
import { cleanText, isValidId, parseIsoDate, parsePayDay, validatePeriodKey } from "./validation.ts";

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(`File dati non valido: «${what}» deve essere un oggetto.`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new ValidationError(`File dati non valido: «${what}» deve essere una lista.`);
  return value;
}

/** Legge solo proprietà proprie (mai ereditate dal prototipo). */
function own(obj: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}

// ------------------------------------------------------------------ scrittura
export function ledgerToJson(ledger: Ledger): Record<string, unknown> {
  const overrides = Object.entries(ledger.overrides)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, params]) => [
      key,
      {
        ...(params.startBalanceCents !== undefined && { saldo_iniziale: centsToDecimalString(params.startBalanceCents) }),
        ...(params.minBalanceCents !== undefined && { saldo_minimo: centsToDecimalString(params.minBalanceCents) }),
      },
    ]);
  return {
    version: SCHEMA_VERSION,
    giorno_inizio: ledger.payDay,
    // fromEntries definisce proprietà proprie: sicuro anche per nomi come «__proto__»
    categorie: Object.fromEntries(ledger.categories.map((c) => [c.name, centsToDecimalString(c.budgetCents)])),
    metodi: [...ledger.methods],
    mesi: Object.fromEntries(overrides),
    movimenti: ledger.movements.map((m) => ({
      id: m.id,
      data: m.date,
      descrizione: m.description,
      categoria: m.category,
      metodo: m.method,
      importo: centsToDecimalString(m.amountCents),
    })),
  };
}

// -------------------------------------------------------------------- lettura
function parseCategories(raw: unknown): CategoryBudget[] {
  const entries = Object.entries(asObject(raw, "categorie"));
  if (entries.length > LIMITS.maxCategories) throw new ValidationError("File dati non valido: troppe categorie.");
  const result: CategoryBudget[] = [];
  for (const [rawName, rawBudget] of entries) {
    const name = cleanText(rawName, "Categoria", LIMITS.maxNameLength);
    const budgetCents = jsonToCents(rawBudget);
    if (budgetCents < 0) throw new ValidationError("File dati non valido: budget negativo.");
    const index = result.findIndex((c) => c.name === name);
    if (index >= 0) result[index] = { name, budgetCents };
    else result.push({ name, budgetCents });
  }
  return result;
}

function parseMethods(raw: unknown): string[] {
  const items = asArray(raw, "metodi");
  if (items.length > LIMITS.maxMethods) throw new ValidationError("File dati non valido: troppi metodi di pagamento.");
  const methods: string[] = [];
  for (const item of items) {
    const name = cleanText(item, "Metodo", LIMITS.maxNameLength);
    if (!methods.includes(name)) methods.push(name);
  }
  return methods;
}

function parseOverrides(raw: unknown): Record<string, PeriodParams> {
  const result: Record<string, PeriodParams> = {};
  for (const [key, entry] of Object.entries(asObject(raw, "mesi"))) {
    validatePeriodKey(key); // solo «AAAA-MM»: nessuna chiave pericolosa
    const fields = asObject(entry, "mesi");
    const start = own(fields, "saldo_iniziale");
    const min = own(fields, "saldo_minimo");
    result[key] = {
      startBalanceCents: start === undefined ? undefined : jsonToCents(start),
      minBalanceCents: min === undefined ? undefined : jsonToCents(min),
    };
  }
  return result;
}

function parseMovements(raw: unknown, newId: () => string): Movement[] {
  const items = asArray(raw, "movimenti");
  if (items.length > LIMITS.maxMovements) throw new ValidationError("File dati non valido: troppi movimenti.");
  const seen = new Set<string>();
  const movements: Movement[] = [];
  for (const item of items) {
    const row = asObject(item, "movimento");
    const rawId = own(row, "id");
    const id = isValidId(rawId) && !seen.has(rawId) ? rawId : newId();
    seen.add(id);
    const amountCents = jsonToCents(own(row, "importo"));
    if (amountCents <= 0) throw new ValidationError("File dati non valido: importo di un movimento non positivo.");
    movements.push({
      id,
      date: parseIsoDate(own(row, "data")),
      description: cleanText(own(row, "descrizione") ?? "", "Descrizione", LIMITS.maxDescriptionLength, true),
      category: cleanText(own(row, "categoria"), "Categoria", LIMITS.maxNameLength),
      method: cleanText(own(row, "metodo"), "Metodo", LIMITS.maxNameLength),
      amountCents,
    });
  }
  return movements;
}

export function ledgerFromJson(raw: unknown, newId: () => string): Ledger {
  const data = asObject(raw, "radice");
  const base = createDefaultLedger();
  const payDay = own(data, "giorno_inizio");
  const categories = own(data, "categorie");
  const methods = own(data, "metodi");
  const overrides = own(data, "mesi");
  const movements = own(data, "movimenti");
  return {
    payDay: payDay === undefined ? DEFAULTS.payDay : parsePayDay(payDay),
    categories: categories === undefined ? base.categories : parseCategories(categories),
    methods: methods === undefined ? base.methods : parseMethods(methods),
    overrides: overrides === undefined ? {} : parseOverrides(overrides),
    movements: movements === undefined ? [] : parseMovements(movements, newId),
  };
}

/** Testo di un backup/file dati -> Ledger validato. */
export function parseBackup(text: string, newId: () => string): Ledger {
  if (text.length > LIMITS.maxBackupChars) throw new ValidationError("Il file è troppo grande.");
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ValidationError("Il file non è un JSON valido.");
  }
  return ledgerFromJson(payload, newId);
}

export function serializeLedger(ledger: Ledger): string {
  return JSON.stringify(ledgerToJson(ledger), null, 2);
}
