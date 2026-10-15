/**
 * Operazioni sui dati: funzioni PURE che restituiscono un nuovo Ledger (mai modifiche in place).
 * La persistenza e il rollback in caso di errore sono gestiti da chi le chiama (AppProvider).
 */
import { DEFAULTS, LIMITS } from "./config.ts";
import { ValidationError } from "./errors.ts";
import { categoryTotals, minBalance, spentByKey, startBalance } from "./metrics.ts";
import type { AddMovementInput, AddOutcome, Change, Deps, Ledger, Movement } from "./models.ts";
import { keyForDate } from "./periods.ts";
import { cleanText, parseIsoDate, parsePayDay, validatePeriodKey } from "./validation.ts";

export function createDefaultLedger(): Ledger {
  return {
    payDay: DEFAULTS.payDay,
    categories: DEFAULTS.categories.map((c) => ({ ...c })),
    methods: [...DEFAULTS.methods],
    overrides: {},
    movements: [],
  };
}

const done = (ledger: Ledger): Change<void> => ({ ledger, value: undefined });

function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, i) => value === right[i]);
}

export const byName = (a: string, b: string): number => a.localeCompare(b, "it", { sensitivity: "base" });

// ------------------------------------------------------------------ movimenti
export function addMovement(ledger: Ledger, input: AddMovementInput, deps: Deps): Change<AddOutcome> {
  const date = parseIsoDate(input.date);
  const description = cleanText(input.description, "Descrizione", LIMITS.maxDescriptionLength, true);
  const category = ledger.categories.find((c) => c.name === input.category);
  if (!category) throw new ValidationError("Seleziona una categoria esistente.");
  if (!ledger.methods.includes(input.method)) throw new ValidationError("Seleziona un metodo di pagamento esistente.");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new ValidationError("L'importo deve essere maggiore di zero.");
  }
  if (input.amountCents > LIMITS.maxAmountCents) throw new ValidationError("Importo troppo grande.");
  if (ledger.movements.length >= LIMITS.maxMovements) {
    throw new ValidationError("Raggiunto il numero massimo di movimenti.");
  }

  const key = keyForDate(date, ledger.payDay);
  const spent = spentByKey(ledger);
  const budget = startBalance(ledger, key, spent, deps.today) - minBalance(ledger, key, spent, deps.today);
  const totalBefore = spent.get(key) ?? 0;
  const categoryBefore = categoryTotals(ledger, key).get(category.name) ?? 0;

  const movement: Movement = {
    id: deps.newId(),
    date,
    description,
    category: category.name,
    method: input.method,
    amountCents: input.amountCents,
  };
  const totalAfter = totalBefore + movement.amountCents;
  const categoryAfter = categoryBefore + movement.amountCents;
  const outcome: AddOutcome = {
    movement,
    periodKey: key,
    periodOverrunCents: totalBefore <= budget && budget < totalAfter ? totalAfter - budget : null,
    categoryAlert:
      categoryBefore <= category.budgetCents && category.budgetCents < categoryAfter
        ? { category: category.name, spentCents: categoryAfter, budgetCents: category.budgetCents }
        : null,
  };
  return { ledger: { ...ledger, movements: [...ledger.movements, movement] }, value: outcome };
}

export function deleteMovements(ledger: Ledger, ids: Iterable<string>): Change<number> {
  const wanted = new Set(ids);
  const kept = ledger.movements.filter((m) => !wanted.has(m.id));
  return { ledger: { ...ledger, movements: kept }, value: ledger.movements.length - kept.length };
}

// --------------------------------------------------------- parametri periodo
export function savePeriodParams(
  ledger: Ledger,
  key: string,
  startBalanceCents: number,
  minBalanceCents: number,
  payDay: unknown,
): Change<void> {
  validatePeriodKey(key);
  const day = parsePayDay(payDay);
  return done({
    ...ledger,
    payDay: day,
    overrides: { ...ledger.overrides, [key]: { startBalanceCents, minBalanceCents } },
  });
}

// ------------------------------------------------------------------ categorie
export function upsertCategory(ledger: Ledger, name: string, budgetCents: number): Change<void> {
  const clean = cleanText(name, "Categoria", LIMITS.maxNameLength);
  if (!Number.isInteger(budgetCents) || budgetCents < 0) throw new ValidationError("Il budget non può essere negativo.");
  if (budgetCents > LIMITS.maxAmountCents) throw new ValidationError("Importo troppo grande.");
  const exists = ledger.categories.some((c) => c.name === clean);
  if (!exists && ledger.categories.length >= LIMITS.maxCategories) {
    throw new ValidationError("Raggiunto il numero massimo di categorie.");
  }
  const entry = { name: clean, budgetCents };
  return done({
    ...ledger,
    categories: exists
      ? ledger.categories.map((c) => (c.name === clean ? entry : c))
      : [...ledger.categories, entry],
  });
}

export function deleteCategory(ledger: Ledger, name: string): Change<void> {
  if (!ledger.categories.some((c) => c.name === name)) throw new ValidationError("Categoria inesistente.");
  return done({ ...ledger, categories: ledger.categories.filter((c) => c.name !== name) });
}

export function reorderCategories(ledger: Ledger, order: readonly string[]): Change<void> {
  if (!sameMembers(order, ledger.categories.map((c) => c.name))) {
    throw new ValidationError("Ordine delle categorie non valido.");
  }
  const categories = order.map((name) => ledger.categories.find((c) => c.name === name)!);
  return done({ ...ledger, categories });
}

export function sortCategories(ledger: Ledger): Change<void> {
  return reorderCategories(ledger, ledger.categories.map((c) => c.name).sort(byName));
}

// --------------------------------------------------------------------- metodi
export function addMethod(ledger: Ledger, name: string): Change<void> {
  const clean = cleanText(name, "Metodo", LIMITS.maxNameLength);
  if (ledger.methods.includes(clean)) throw new ValidationError("Metodo già presente.");
  if (ledger.methods.length >= LIMITS.maxMethods) throw new ValidationError("Raggiunto il numero massimo di metodi.");
  return done({ ...ledger, methods: [...ledger.methods, clean] });
}

export function deleteMethod(ledger: Ledger, name: string): Change<void> {
  if (!ledger.methods.includes(name)) throw new ValidationError("Metodo inesistente.");
  return done({ ...ledger, methods: ledger.methods.filter((m) => m !== name) });
}

export function reorderMethods(ledger: Ledger, order: readonly string[]): Change<void> {
  if (!sameMembers(order, ledger.methods)) throw new ValidationError("Ordine dei metodi non valido.");
  return done({ ...ledger, methods: [...order] });
}

export function sortMethods(ledger: Ledger): Change<void> {
  return reorderMethods(ledger, [...ledger.methods].sort(byName));
}
