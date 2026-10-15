/** Calcoli di sola lettura: spese, saldi riportati, indicatori del periodo. */
import { DEFAULTS } from "./config.ts";
import type { Ledger, Movement, PeriodMetrics } from "./models.ts";
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

export function categoryTotals(ledger: Ledger, key: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const m of movementsForKey(ledger, key)) {
    totals.set(m.category, (totals.get(m.category) ?? 0) + m.amountCents);
  }
  return totals;
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
  const keys = [...Object.keys(ledger.overrides), ...spent.keys()];
  return keys.length > 0 ? keys.reduce((a, b) => (a < b ? a : b)) : currentKey(ledger, today);
}

/** Saldo a inizio periodo: impostato a mano, altrimenti riportato dal periodo precedente (iterativo). */
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
  while (cursor < key) {
    balance -= spent.get(cursor) ?? 0;
    cursor = nextKey(cursor);
  }
  return balance;
}

export function minBalance(ledger: Ledger, key: string, spent: SpentByKey, today: string): number {
  const earliest = earliestKey(ledger, spent, today);
  let cursor = key;
  for (;;) {
    const manual = ledger.overrides[cursor]?.minBalanceCents;
    if (manual !== undefined) return manual;
    if (cursor <= earliest) return DEFAULTS.minBalanceCents;
    cursor = prevKey(cursor);
  }
}

export function computeMetrics(ledger: Ledger, key: string, today: string): PeriodMetrics {
  const { start, end } = periodBounds(key, ledger.payDay);
  const totalDays = daysBetween(start, end) + 1;
  const elapsed = today < start ? 0 : today > end ? totalDays : daysBetween(start, today) + 1;
  const remaining = totalDays - elapsed;

  const spentMap = spentByKey(ledger);
  const startBalanceCents = startBalance(ledger, key, spentMap, today);
  const minBalanceCents = minBalance(ledger, key, spentMap, today);
  const budgetCents = startBalanceCents - minBalanceCents;
  const spentCents = spentMap.get(key) ?? 0;
  const remainingBudgetCents = budgetCents - spentCents;
  const currentBalanceCents = startBalanceCents - spentCents;

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
  let top: Movement | null = null;
  for (const m of rows) if (top === null || m.amountCents > top.amountCents) top = m;

  return {
    key,
    startDate: start,
    endDate: end,
    startBalanceCents,
    minBalanceCents,
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
    overBudget: spentCents > budgetCents,
  };
}
