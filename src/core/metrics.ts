/** Calcoli di sola lettura: spese, saldi riportati, indicatori del periodo. */
import { DEFAULTS } from "./config.ts";
import type { CategoryRow, Fund, Ledger, Movement, PeriodMetrics } from "./models.ts";
import { divRound } from "./money.ts";
import { daysBetween, keyForDate, keyInRange, nextKey, periodBounds, prevKey } from "./periods.ts";

export type SpentByKey = ReadonlyMap<string, number>;

export function spentByKey(ledger: Ledger): Map<string, number> {
  const totals = new Map<string, number>();
  for (const m of ledger.movements) {
    const key = keyForDate(m.date, ledger.payDay);
    totals.set(key, (totals.get(key) ?? 0) + m.amountCents);
  }
  return totals;
}

/** Movimenti del periodo, dal più recente. */
export function movementsForKey(ledger: Ledger, key: string): Movement[] {
  return ledger.movements
    .filter((m) => keyForDate(m.date, ledger.payDay) === key)
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1));
}

export function fundsByKey(ledger: Ledger): Map<string, number> {
  const totals = new Map<string, number>();
  for (const f of ledger.funds) {
    const key = keyForDate(f.date, ledger.payDay);
    totals.set(key, (totals.get(key) ?? 0) + f.amountCents);
  }
  return totals;
}

/** Fondi del periodo, dal più recente. */
export function fundsForKey(ledger: Ledger, key: string): Fund[] {
  return ledger.funds
    .filter((f) => keyForDate(f.date, ledger.payDay) === key)
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1));
}

export function categoryTotals(ledger: Ledger, key: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const m of movementsForKey(ledger, key)) {
    totals.set(m.category, (totals.get(m.category) ?? 0) + m.amountCents);
  }
  return totals;
}

/** Tutte le categorie con la spesa del periodo (nell'ordine scelto dall'utente), più quelle senza budget che hanno movimenti. */
export function categoryOverview(ledger: Ledger, key: string): CategoryRow[] {
  const totals = categoryTotals(ledger, key);
  const budgeted = new Set(ledger.categories.map((c) => c.name));
  return [
    ...ledger.categories.map((c) => ({ name: c.name, budgetCents: c.budgetCents as number | null, spentCents: totals.get(c.name) ?? 0 })),
    ...[...totals.keys()].filter((name) => !budgeted.has(name)).map((name) => ({ name, budgetCents: null, spentCents: totals.get(name) ?? 0 })),
  ];
}

/** Le categorie dove si è speso di più (solo con spesa > 0), per la vista sintetica della home. */
export function pickTopCategories(rows: readonly CategoryRow[], limit: number): { shown: CategoryRow[]; hiddenCount: number } {
  const shown = rows.filter((r) => r.spentCents > 0).sort((a, b) => b.spentCents - a.spentCents).slice(0, limit);
  return { shown, hiddenCount: rows.length - shown.length };
}

export function totalCategoryBudget(ledger: Ledger): number {
  return ledger.categories.reduce((sum, c) => sum + c.budgetCents, 0);
}

export function currentKey(ledger: Ledger, today: string): string {
  return keyForDate(today, ledger.payDay);
}

/** Sposta il periodo di ±1 restando nell'intervallo supportato. */
export function shiftKey(key: string, delta: number): string {
  const candidate = delta > 0 ? nextKey(key) : prevKey(key);
  return keyInRange(candidate) ? candidate : key;
}

function earliestKey(ledger: Ledger, spent: SpentByKey, today: string): string {
  const keys = [...Object.keys(ledger.overrides), ...spent.keys(), ...fundsByKey(ledger).keys()];
  return keys.length > 0 ? keys.reduce((a, b) => (a < b ? a : b)) : currentKey(ledger, today);
}

/**
 * Saldo a inizio periodo: impostato a mano, altrimenti riportato dal periodo precedente
 * (saldo iniziale + fondi − spese del periodo precedente). Calcolo iterativo.
 */
export function startBalance(ledger: Ledger, key: string, spent: SpentByKey, today: string): number {
  const earliest = earliestKey(ledger, spent, today);
  let cursor = key;
  let balance: number;
  for (;;) {
    const manual = ledger.overrides[cursor]?.startBalanceCents;
    if (manual !== undefined) {
      balance = manual;
      break;
    }
    if (cursor <= earliest) {
      balance = DEFAULTS.startBalanceCents;
      break;
    }
    cursor = prevKey(cursor);
  }
  const funds = fundsByKey(ledger);
  while (cursor < key) {
    balance += (funds.get(cursor) ?? 0) - (spent.get(cursor) ?? 0);
    cursor = nextKey(cursor);
  }
  return balance;
}

/** Saldo di partenza effettivo del periodo: saldo a inizio periodo + fondi aggiunti nel periodo. */
export function openingBalance(ledger: Ledger, key: string, spent: SpentByKey, today: string): number {
  return startBalance(ledger, key, spent, today) + (fundsByKey(ledger).get(key) ?? 0);
}

/** Minimo automatico: saldo di partenza (inizio periodo + fondi) − totale dei budget delle categorie (può essere negativo). */
export function autoMinBalance(ledger: Ledger, key: string, spent: SpentByKey, today: string): number {
  return openingBalance(ledger, key, spent, today) - totalCategoryBudget(ledger);
}

/** Minimo del periodo: valore impostato a mano per QUEL periodo, altrimenti quello automatico. */
export function minBalance(ledger: Ledger, key: string, spent: SpentByKey, today: string): number {
  return ledger.overrides[key]?.minBalanceCents ?? autoMinBalance(ledger, key, spent, today);
}

export function computeMetrics(ledger: Ledger, key: string, today: string): PeriodMetrics {
  const { start, end } = periodBounds(key, ledger.payDay);
  const totalDays = daysBetween(start, end) + 1;
  const elapsed = today < start ? 0 : today > end ? totalDays : daysBetween(start, today) + 1;
  const remaining = totalDays - elapsed;

  const spentMap = spentByKey(ledger);
  const startBalanceCents = startBalance(ledger, key, spentMap, today);
  const autoMinBalanceCents = autoMinBalance(ledger, key, spentMap, today);
  const minBalanceCents = ledger.overrides[key]?.minBalanceCents ?? autoMinBalanceCents;
  const fundList = fundsForKey(ledger, key);
  const fundsCents = fundList.reduce((sum, f) => sum + f.amountCents, 0);
  const openingBalanceCents = startBalanceCents + fundsCents;
  const budgetCents = openingBalanceCents - minBalanceCents;
  const spentCents = spentMap.get(key) ?? 0;
  const remainingBudgetCents = budgetCents - spentCents;
  const currentBalanceCents = openingBalanceCents - spentCents;

  const percentTenths =
    budgetCents > 0
      ? Number(divRound(BigInt(spentCents) * 1000n, BigInt(budgetCents)))
      : spentCents > 0
        ? 1000
        : 0;

  const E = BigInt(elapsed);
  const R = BigInt(remaining);
  const dailyAverageCents = elapsed > 0 ? Number(divRound(BigInt(spentCents), E)) : 0;
  // saldo previsto = saldo attuale − (spese ÷ giorni trascorsi) × giorni rimasti, arrotondato una volta sola
  const forecastBalanceCents =
    elapsed > 0
      ? Number(divRound(BigInt(currentBalanceCents) * E - BigInt(spentCents) * R, E))
      : currentBalanceCents;
  const dailyBudgetLeftCents =
    remaining > 0 ? Number(divRound(BigInt(remainingBudgetCents), R)) : null;

  const rows = movementsForKey(ledger, key);
  const todayInPeriod = today >= start && today <= end;
  const todayRows = todayInPeriod ? rows.filter((m) => m.date === today) : [];
  let top: Movement | null = null;
  for (const m of rows) if (top === null || m.amountCents > top.amountCents) top = m;

  return {
    key,
    startDate: start,
    endDate: end,
    startBalanceCents,
    fundsCents,
    fundCount: fundList.length,
    openingBalanceCents,
    minBalanceCents,
    minBalanceIsAuto: ledger.overrides[key]?.minBalanceCents === undefined,
    autoMinBalanceCents,
    budgetCents,
    spentCents,
    remainingBudgetCents,
    percentTenths,
    currentBalanceCents,
    dailyAverageCents,
    daysElapsed: elapsed,
    daysRemaining: remaining,
    forecastBalanceCents,
    dailyBudgetLeftCents,
    topMovement: top,
    movementCount: rows.length,
    todayInPeriod,
    todaySpentCents: todayRows.reduce((sum, m) => sum + m.amountCents, 0),
    todayMovementCount: todayRows.length,
    overBudget: spentCents > budgetCents,
  };
}
