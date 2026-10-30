/** Test della logica (nessun browser): `npm test` — usa il test runner integrato di Node. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addFund,
  addMethod,
  addMovement,
  AppError,
  categoryOverview,
  categoryTotals,
  centsToDecimalString,
  cleanText,
  computeMetrics,
  createDefaultLedger,
  currentKey,
  deleteCategory,
  deleteFunds,
  deleteMovements,
  fundsForKey,
  divRound,
  formatDateIt,
  formatEur,
  formatPercentTenths,
  formatPeriodLabel,
  keyForDate,
  ledgerFromJson,
  parseAmount,
  parseBackup,
  pickTopCategories,
  plural,
  parseIsoDate,
  periodBounds,
  reorderCategories,
  savePeriodParams,
  serializeLedger,
  shiftKey,
  sortCategories,
  startBalance,
  spentByKey,
  totalCategoryBudget,
  updateCategory,
  updateFund,
  updateMethod,
  updateMovement,
  upsertCategory,
  ValidationError,
  type Change,
  type Ledger,
} from "../src/core/index.ts";

let counter = 0;
const newId = (): string => `id${++counter}`;
const TODAY = "2026-10-24";
const deps = { newId, today: TODAY };

/** Ledger con saldo 10.000 € e minimo 9.500 € nel periodo 2026-10. */
function baseLedger(): Ledger {
  return savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, 950_000, 15).ledger;
}

function add(ledger: Ledger, date: string, category: string, cents: number): Change<ReturnType<typeof addMovement>["value"]> {
  return addMovement(ledger, { date, description: "", category, method: "Contanti", amountCents: cents }, deps);
}

describe("importi", () => {
  it("interpreta formati italiani validi", () => {
    assert.equal(parseAmount("1.234,56"), 123_456);
    assert.equal(parseAmount("12,5"), 1_250);
    assert.equal(parseAmount("€ 7"), 700);
    assert.equal(parseAmount("-5"), -500);
    assert.equal(parseAmount("0,01"), 1);
  });

  it("rifiuta input pericolosi o ambigui", () => {
    for (const text of ["1e5", "nan", "inf", "abc", "", "12,345", "1,2,3", "9".repeat(20), "--1", "1.234", "0x10"]) {
      assert.throws(() => parseAmount(text), ValidationError, text);
    }
  });

  it("formatta in italiano", () => {
    assert.equal(formatEur(123_450), "1.234,50 €");
    assert.equal(formatEur(-5), "-0,05 €");
    assert.equal(formatEur(0), "0,00 €");
    assert.equal(formatEur(100_000_000), "1.000.000,00 €");
    assert.equal(formatPercentTenths(305), "30,5 %");
    assert.equal(centsToDecimalString(1_250), "12.50");
    assert.equal(centsToDecimalString(-5), "-0.05");
    assert.equal(formatDateIt("2026-10-06"), "06/10/2026");
    assert.equal(plural(1, "versamento", "versamenti"), "1 versamento");
    assert.equal(plural(0, "versamento", "versamenti"), "0 versamenti");
    assert.equal(plural(2, "versamento", "versamenti"), "2 versamenti");
    assert.equal(formatPeriodLabel("2026-10-15", "2026-11-14"), "15 ott – 14 nov 2026");
  });

  it("arrotonda mezzo-lontano-da-zero", () => {
    assert.equal(divRound(5n, 2n), 3n);
    assert.equal(divRound(-5n, 2n), -3n);
    assert.equal(divRound(7n, 3n), 2n);
    assert.equal(divRound(1_000n, 3n), 333n);
    assert.throws(() => divRound(1n, 0n), ValidationError);
  });
});

describe("validazione", () => {
  it("pulisce i testi", () => {
    assert.equal(cleanText("  Ciao\u0000 \u202e mondo\n", "x", 40), "Ciao mondo");
    assert.throws(() => cleanText("   ", "x", 10), ValidationError);
    assert.throws(() => cleanText("a".repeat(11), "x", 10), ValidationError);
    assert.throws(() => cleanText(42, "x", 10), ValidationError);
    assert.equal(cleanText("", "x", 10, true), "");
  });

  it("controlla le date", () => {
    assert.equal(parseIsoDate("2026-10-06"), "2026-10-06");
    for (const bad of ["06/10/2026", "2026-02-31", "1999-01-01", "2101-01-01", "", "2026-1-1"]) {
      assert.throws(() => parseIsoDate(bad), ValidationError, bad);
    }
  });
});

describe("periodi", () => {
  it("assegna le date al periodo giusto", () => {
    assert.equal(keyForDate("2026-01-14", 15), "2025-12");
    assert.equal(keyForDate("2026-01-15", 15), "2026-01");
    assert.deepEqual(periodBounds("2026-01", 15), { start: "2026-01-15", end: "2026-02-14" });
    assert.deepEqual(periodBounds("2026-12", 15), { start: "2026-12-15", end: "2027-01-14" });
    assert.deepEqual(periodBounds("2027-02", 28), { start: "2027-02-28", end: "2027-03-27" });
  });

  it("naviga restando nell'intervallo", () => {
    assert.equal(shiftKey("2026-12", 1), "2027-01");
    assert.equal(shiftKey("2026-01", -1), "2025-12");
    assert.equal(shiftKey("2100-12", 1), "2100-12");
    assert.equal(shiftKey("2000-01", -1), "2000-01");
    assert.equal(currentKey(createDefaultLedger(), "2026-10-14"), "2026-09");
  });
});

describe("calcoli del periodo", () => {
  it("calcola gli indicatori", () => {
    let ledger = baseLedger();
    ledger = add(ledger, "2026-10-16", "Casa", 10_000).ledger;
    ledger = add(ledger, "2026-10-20", "Casa", 5_000).ledger;
    const m = computeMetrics(ledger, "2026-10", TODAY); // 10 giorni trascorsi su 31
    assert.equal(m.budgetCents, 50_000);
    assert.equal(m.spentCents, 15_000);
    assert.equal(m.remainingBudgetCents, 35_000);
    assert.equal(m.percentTenths, 300);
    assert.equal(m.daysElapsed, 10);
    assert.equal(m.daysRemaining, 21);
    assert.equal(m.dailyAverageCents, 1_500);
    assert.equal(m.forecastBalanceCents, 953_500); // 9.850 − 15 × 21
    assert.equal(m.dailyBudgetLeftCents, 1_667);
    assert.equal(m.topMovement?.amountCents, 10_000);
    assert.equal(m.movementCount, 2);
    assert.equal(m.overBudget, false);
  });

  it("gestisce periodi futuri e conclusi", () => {
    const ledger = add(baseLedger(), "2026-10-16", "Casa", 10_000).ledger;
    const future = computeMetrics(ledger, "2026-12", TODAY);
    assert.equal(future.daysElapsed, 0);
    assert.equal(future.dailyAverageCents, 0);
    assert.equal(future.forecastBalanceCents, future.currentBalanceCents);
    const past = computeMetrics(ledger, "2026-10", "2027-03-01");
    assert.equal(past.daysRemaining, 0);
    assert.equal(past.dailyBudgetLeftCents, null);
  });

  it("riporta il saldo e non ricorre all'infinito", () => {
    const ledger = add(baseLedger(), "2026-10-20", "Casa", 20_000).ledger;
    const spent = spentByKey(ledger);
    assert.equal(startBalance(ledger, "2026-11", spent, TODAY), 980_000);
    assert.equal(startBalance(ledger, "2100-12", spent, TODAY), 980_000);
    // il minimo manuale vale solo per il suo periodo: gli altri sono automatici (saldo − totale budget)
    assert.equal(computeMetrics(ledger, "2026-11", TODAY).minBalanceCents, 980_000 - totalCategoryBudget(ledger));
  });

  it("budget non positivo", () => {
    const ledger = savePeriodParams(createDefaultLedger(), "2026-10", 100, 500, 15).ledger;
    assert.equal(computeMetrics(ledger, "2026-10", TODAY).percentTenths, 0);
    const spent = add(ledger, "2026-10-16", "Casa", 1).ledger;
    assert.equal(computeMetrics(spent, "2026-10", TODAY).percentTenths, 1000);
  });
});

describe("modifica di movimenti e fondi", () => {
  const edit = (ledger: Ledger, id: string, patch: Partial<{ date: string; description: string; category: string; method: string; amountCents: number }>) => {
    const old = ledger.movements.find((m) => m.id === id)!;
    return updateMovement(
      ledger,
      id,
      { date: old.date, description: old.description, category: old.category, method: old.method, amountCents: old.amountCents, ...patch },
      deps,
    );
  };

  it("corregge importo, descrizione, categoria e metodo mantenendo l'id", () => {
    const created = add(baseLedger(), "2026-10-16", "Casa", 25_000);
    const id = created.value.movement.id;
    const fixed = edit(created.ledger, id, { amountCents: 2_500, description: "Pizza", category: "Svago", method: "Bancomat" });
    const m = fixed.ledger.movements.find((x) => x.id === id)!;
    assert.deepEqual([m.amountCents, m.description, m.category, m.method], [2_500, "Pizza", "Svago", "Bancomat"]);
    assert.equal(fixed.ledger.movements.length, 1);
    assert.equal(computeMetrics(fixed.ledger, "2026-10", TODAY).spentCents, 2_500);
  });

  it("spostando la data in un altro periodo ricalcola i saldi riportati", () => {
    const created = add(baseLedger(), "2026-10-16", "Casa", 10_000);
    const id = created.value.movement.id;
    assert.equal(startBalance(created.ledger, "2026-11", spentByKey(created.ledger), TODAY), 990_000);
    const moved = edit(created.ledger, id, { date: "2026-11-20" });
    assert.equal(moved.value.periodKey, "2026-11");
    assert.equal(computeMetrics(moved.ledger, "2026-10", TODAY).spentCents, 0);
    assert.equal(computeMetrics(moved.ledger, "2026-11", TODAY).spentCents, 10_000);
    assert.equal(startBalance(moved.ledger, "2026-11", spentByKey(moved.ledger), TODAY), 1_000_000);
  });

  it("segnala il superamento solo se è la modifica a provocarlo", () => {
    let ledger = baseLedger(); // budget 500 €, Casa 100 €
    const created = add(ledger, "2026-10-16", "Casa", 5_000);
    ledger = created.ledger;
    const fixed = edit(ledger, created.value.movement.id, { amountCents: 12_000 });
    assert.equal(fixed.value.categoryAlert?.spentCents, 12_000);
    assert.equal(fixed.value.periodOverrunCents, null);
    const again = edit(fixed.ledger, created.value.movement.id, { amountCents: 13_000 });
    assert.equal(again.value.categoryAlert, null); // già oltre prima della modifica
    const big = edit(fixed.ledger, created.value.movement.id, { category: "Alimentari", amountCents: 60_000 });
    assert.equal(big.value.periodOverrunCents, 10_000);
  });

  it("riducendo l'importo non produce avvisi", () => {
    const created = add(baseLedger(), "2026-10-16", "Casa", 12_000);
    const fixed = edit(created.ledger, created.value.movement.id, { amountCents: 1_000 });
    assert.equal(fixed.value.categoryAlert, null);
    assert.equal(fixed.value.periodOverrunCents, null);
  });

  it("accetta una categoria/metodo ormai eliminati solo se restano invariati", () => {
    const created = add(baseLedger(), "2026-10-16", "Casa", 1_000);
    const id = created.value.movement.id;
    const withoutCasa = deleteCategory(created.ledger, "Casa").ledger;
    const ok = edit(withoutCasa, id, { amountCents: 2_000 });
    assert.equal(ok.ledger.movements[0]?.category, "Casa");
    assert.throws(() => edit(withoutCasa, id, { category: "Inventata" }), ValidationError);
    const noMethod = { ...created.ledger, methods: ["Bonifico"] };
    assert.equal(edit(noMethod, id, { amountCents: 5 }).ledger.movements[0]?.method, "Contanti");
    assert.throws(() => edit(noMethod, id, { method: "Assegno" }), ValidationError);
  });

  it("rifiuta dati non validi e id inesistenti; non modifica lo stato precedente", () => {
    const created = add(baseLedger(), "2026-10-16", "Casa", 1_000);
    const id = created.value.movement.id;
    const before = serializeLedger(created.ledger);
    for (const patch of [{ amountCents: 0 }, { amountCents: 1.5 }, { amountCents: 10_000_000_001 }, { date: "2026-02-31" }, { description: "x".repeat(121) }]) {
      assert.throws(() => edit(created.ledger, id, patch), ValidationError, JSON.stringify(patch));
    }
    assert.throws(() => updateMovement(created.ledger, "nope", { date: "2026-10-16", description: "", category: "Casa", method: "Contanti", amountCents: 1 }, deps), ValidationError);
    assert.equal(serializeLedger(created.ledger), before);
  });

  it("corregge un fondo e ne ricalcola il periodo", () => {
    const base = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, null, 15).ledger;
    const fund = addFund(base, { date: "2026-10-20", description: "Bonus", amountCents: 300_00 }, deps);
    const fixed = updateFund(fund.ledger, fund.value.fund.id, { date: "2026-11-20", description: "Bonus novembre", amountCents: 150_00 });
    assert.equal(fixed.value.periodKey, "2026-11");
    assert.equal(computeMetrics(fixed.ledger, "2026-10", TODAY).fundsCents, 0);
    assert.equal(computeMetrics(fixed.ledger, "2026-11", TODAY).fundsCents, 15_000);
    assert.equal(fixed.ledger.funds.length, 1);
    assert.throws(() => updateFund(fund.ledger, "nope", { date: "2026-10-20", description: "", amountCents: 1 }), ValidationError);
    assert.throws(() => updateFund(fund.ledger, fund.value.fund.id, { date: "2026-10-20", description: "", amountCents: 0 }), ValidationError);
  });
});

describe("modifica di categorie e metodi", () => {
  it("rinomina una categoria e aggiorna i movimenti già registrati, mantenendo l'ordine", () => {
    let ledger = baseLedger();
    ledger = add(ledger, "2026-10-16", "Casa", 1_000).ledger;
    ledger = add(ledger, "2026-10-17", "Svago", 500).ledger;
    const position = ledger.categories.findIndex((c) => c.name === "Casa");
    const renamed = updateCategory(ledger, "Casa", "Abitazione", 15_000).ledger;
    assert.equal(renamed.categories[position]?.name, "Abitazione");
    assert.equal(renamed.categories[position]?.budgetCents, 15_000);
    assert.ok(!renamed.categories.some((c) => c.name === "Casa"));
    assert.deepEqual(renamed.movements.map((m) => m.category), ["Abitazione", "Svago"]);
    assert.equal(categoryTotals(renamed, "2026-10").get("Abitazione"), 1_000);
  });

  it("cambia solo il budget senza toccare i movimenti", () => {
    const ledger = add(baseLedger(), "2026-10-16", "Casa", 1_000).ledger;
    const changed = updateCategory(ledger, "Casa", "Casa", 99_900);
    assert.equal(changed.ledger.categories.find((c) => c.name === "Casa")?.budgetCents, 99_900);
    assert.deepEqual(changed.ledger.movements, ledger.movements);
  });

  it("rifiuta duplicati, nomi vuoti, budget non validi e categorie inesistenti", () => {
    const ledger = baseLedger();
    assert.throws(() => updateCategory(ledger, "Casa", "Svago", 100), ValidationError);
    assert.throws(() => updateCategory(ledger, "Casa", "   ", 100), ValidationError);
    assert.throws(() => updateCategory(ledger, "Casa", "Casa", -1), ValidationError);
    assert.throws(() => updateCategory(ledger, "Casa", "Casa", 1.5), ValidationError);
    assert.throws(() => updateCategory(ledger, "Nessuna", "X", 100), ValidationError);
  });

  it("rinomina un metodo e aggiorna i movimenti; rifiuta duplicati", () => {
    let ledger = baseLedger();
    ledger = add(ledger, "2026-10-16", "Casa", 1_000).ledger; // metodo «Contanti»
    const renamed = updateMethod(ledger, "Contanti", "Cash").ledger;
    assert.ok(renamed.methods.includes("Cash") && !renamed.methods.includes("Contanti"));
    assert.equal(renamed.movements[0]?.method, "Cash");
    assert.equal(renamed.methods.indexOf("Cash"), ledger.methods.indexOf("Contanti"));
    assert.throws(() => updateMethod(ledger, "Contanti", "Bonifico"), ValidationError);
    assert.throws(() => updateMethod(ledger, "Inesistente", "X"), ValidationError);
    assert.throws(() => updateMethod(ledger, "Contanti", ""), ValidationError);
  });

  it("dopo la rinomina si può aggiungere un movimento con il nuovo nome ma non con il vecchio", () => {
    const renamed = updateCategory(baseLedger(), "Casa", "Abitazione", 10_000).ledger;
    assert.doesNotThrow(() => add(renamed, "2026-10-16", "Abitazione", 100));
    assert.throws(() => add(renamed, "2026-10-16", "Casa", 100), ValidationError);
  });
});

describe("riepilogo per categoria", () => {
  it("elenca tutte le categorie nell'ordine dell'utente più quelle senza budget con movimenti", () => {
    let ledger = baseLedger();
    ledger = add(ledger, "2026-10-16", "Casa", 1_000).ledger;
    ledger = add(ledger, "2026-10-17", "Altro", 300).ledger;
    ledger = deleteCategory(ledger, "Altro").ledger; // «Altro» resta sui movimenti ma senza budget
    const rows = categoryOverview(ledger, "2026-10");
    assert.deepEqual(rows.slice(0, ledger.categories.length).map((r) => r.name), ledger.categories.map((c) => c.name));
    assert.equal(rows.find((r) => r.name === "Casa")?.spentCents, 1_000);
    assert.equal(rows.find((r) => r.name === "Trasporti")?.spentCents, 0);
    const orphan = rows.at(-1);
    assert.deepEqual([orphan?.name, orphan?.budgetCents, orphan?.spentCents], ["Altro", null, 300]);
  });

  it("la vista sintetica mostra solo le categorie con spesa, dalla più alta, entro il limite", () => {
    let ledger = baseLedger();
    for (const [cat, cents] of [["Casa", 500], ["Svago", 900], ["Salute", 100], ["Trasporti", 700], ["Alimentari", 300], ["Altro", 200]] as const) {
      ledger = add(ledger, "2026-10-16", cat, cents).ledger;
    }
    const rows = categoryOverview(ledger, "2026-10");
    const top = pickTopCategories(rows, 3);
    assert.deepEqual(top.shown.map((r) => r.name), ["Svago", "Trasporti", "Casa"]);
    assert.equal(top.hiddenCount, rows.length - 3);
    assert.equal(pickTopCategories(rows, 20).shown.length, 6); // mai le categorie a zero
  });

  it("senza spese la vista sintetica è vuota ma le categorie restano disponibili", () => {
    const rows = categoryOverview(baseLedger(), "2026-10");
    const top = pickTopCategories(rows, 5);
    assert.equal(top.shown.length, 0);
    assert.equal(top.hiddenCount, rows.length);
  });

  it("non modifica l'elenco ricevuto", () => {
    const rows = categoryOverview(add(baseLedger(), "2026-10-16", "Svago", 100).ledger, "2026-10");
    const names = rows.map((r) => r.name);
    pickTopCategories(rows, 2);
    assert.deepEqual(rows.map((r) => r.name), names);
  });
});

describe("spese di oggi", () => {
  it("somma solo le uscite con la data di oggi", () => {
    let ledger = baseLedger();
    ledger = add(ledger, "2026-10-24", "Casa", 1_000).ledger;
    ledger = add(ledger, "2026-10-24", "Svago", 250).ledger;
    ledger = add(ledger, "2026-10-23", "Casa", 9_999).ledger; // ieri: non conta
    ledger = addFund(ledger, { date: "2026-10-24", description: "", amountCents: 50_000 }, deps).ledger; // i fondi non sono spese
    const m = computeMetrics(ledger, "2026-10", TODAY);
    assert.equal(m.todayInPeriod, true);
    assert.equal(m.todaySpentCents, 1_250);
    assert.equal(m.todayMovementCount, 2);
  });

  it("nessuna spesa oggi: zero", () => {
    const ledger = add(baseLedger(), "2026-10-20", "Casa", 1_000).ledger;
    const m = computeMetrics(ledger, "2026-10", TODAY);
    assert.equal(m.todayInPeriod, true);
    assert.equal(m.todaySpentCents, 0);
    assert.equal(m.todayMovementCount, 0);
  });

  it("se oggi non è nel periodo visualizzato non si applica", () => {
    const ledger = add(baseLedger(), "2026-10-24", "Casa", 1_000).ledger;
    for (const key of ["2026-09", "2026-11"]) {
      const m = computeMetrics(ledger, key, TODAY);
      assert.equal(m.todayInPeriod, false);
      assert.equal(m.todaySpentCents, 0);
    }
  });

  it("il giorno dello stipendio e il giorno prima cadono in periodi diversi", () => {
    const ledger = add(baseLedger(), "2026-10-15", "Casa", 700).ledger;
    assert.equal(computeMetrics(ledger, "2026-10", "2026-10-15").todaySpentCents, 700);
    assert.equal(computeMetrics(ledger, "2026-10", "2026-10-14").todayInPeriod, false);
    assert.equal(computeMetrics(ledger, "2026-09", "2026-10-14").todaySpentCents, 0);
  });
});

describe("saldo minimo automatico", () => {
  const TOTAL = 56_000; // somma dei budget predefiniti: 560,00 €

  it("di default è saldo iniziale − totale budget", () => {
    const ledger = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, null, 15).ledger;
    assert.equal(totalCategoryBudget(ledger), TOTAL);
    const m = computeMetrics(ledger, "2026-10", TODAY);
    assert.equal(m.minBalanceIsAuto, true);
    assert.equal(m.minBalanceCents, 1_000_000 - TOTAL);
    assert.equal(m.budgetCents, TOTAL);
    assert.equal(m.autoMinBalanceCents, m.minBalanceCents);
  });

  it("segue le modifiche ai budget delle categorie", () => {
    let ledger = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, null, 15).ledger;
    ledger = upsertCategory(ledger, "Casa", 20_000).ledger; // +100 €
    const m = computeMetrics(ledger, "2026-10", TODAY);
    assert.equal(m.budgetCents, TOTAL + 10_000);
    assert.equal(m.minBalanceCents, 1_000_000 - TOTAL - 10_000);
  });

  it("il valore manuale vale solo per il proprio periodo e si può ripristinare", () => {
    let ledger = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, 950_000, 15).ledger;
    let m = computeMetrics(ledger, "2026-10", TODAY);
    assert.equal(m.minBalanceIsAuto, false);
    assert.equal(m.minBalanceCents, 950_000);
    assert.equal(m.autoMinBalanceCents, 1_000_000 - TOTAL);
    assert.equal(computeMetrics(ledger, "2026-11", TODAY).minBalanceIsAuto, true);
    ledger = savePeriodParams(ledger, "2026-10", 1_000_000, null, 15).ledger;
    m = computeMetrics(ledger, "2026-10", TODAY);
    assert.equal(m.minBalanceIsAuto, true);
    assert.equal(ledger.overrides["2026-10"]?.minBalanceCents, undefined);
  });

  it("consente un minimo negativo quando i budget superano il saldo", () => {
    const ledger = savePeriodParams(createDefaultLedger(), "2026-10", 10_000, null, 15).ledger;
    assert.equal(computeMetrics(ledger, "2026-10", TODAY).minBalanceCents, 10_000 - TOTAL);
  });

  it("gli avvisi usano il budget automatico", () => {
    const ledger = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, null, 15).ledger;
    const out = add(ledger, "2026-10-16", "Alimentari", 60_000); // 600 € su 560 €
    assert.equal(out.value.periodOverrunCents, 4_000);
  });

  it("round-trip: automatico resta automatico, manuale resta manuale", () => {
    const auto = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, null, 15).ledger;
    assert.equal(parseBackup(serializeLedger(auto), newId).overrides["2026-10"]?.minBalanceCents, undefined);
    const manual = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, 900_000, 15).ledger;
    assert.equal(parseBackup(serializeLedger(manual), newId).overrides["2026-10"]?.minBalanceCents, 900_000);
  });

  it("rifiuta importi non validi", () => {
    assert.throws(() => savePeriodParams(createDefaultLedger(), "2026-10", 1.5, null, 15), ValidationError);
    assert.throws(() => savePeriodParams(createDefaultLedger(), "2026-10", 0, 1e12, 15), ValidationError);
  });
});

describe("fondi", () => {
  const TOTAL = 56_000;
  const fund = (ledger: Ledger, date: string, cents: number) => addFund(ledger, { date, description: "Versamento", amountCents: cents }, deps);

  it("aumentano saldo attuale e minimo automatico; il budget non cambia", () => {
    const base = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, null, 15).ledger;
    const ledger = fund(base, "2026-10-20", 30_000).ledger;
    const m = computeMetrics(ledger, "2026-10", TODAY);
    assert.equal(m.startBalanceCents, 1_000_000);
    assert.equal(m.fundsCents, 30_000);
    assert.equal(m.fundCount, 1);
    assert.equal(m.openingBalanceCents, 1_030_000);
    assert.equal(m.currentBalanceCents, 1_030_000);
    assert.equal(m.minBalanceCents, 1_030_000 - TOTAL); // il minimo sale dello stesso importo
    assert.equal(m.budgetCents, TOTAL); // budget invariato
  });

  it("con il minimo manuale aumentano il budget spendibile", () => {
    const base = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, 950_000, 15).ledger;
    const m = computeMetrics(fund(base, "2026-10-20", 30_000).ledger, "2026-10", TODAY);
    assert.equal(m.minBalanceCents, 950_000);
    assert.equal(m.budgetCents, 80_000); // 10.300 − 9.500
    assert.equal(m.remainingBudgetCents, 80_000);
  });

  it("le spese si sottraggono al saldo comprensivo dei fondi e la previsione ne tiene conto", () => {
    let ledger = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, 950_000, 15).ledger;
    ledger = fund(ledger, "2026-10-16", 20_000).ledger;
    ledger = add(ledger, "2026-10-20", "Casa", 10_000).ledger;
    const m = computeMetrics(ledger, "2026-10", TODAY); // 10 giorni su 31
    assert.equal(m.currentBalanceCents, 1_010_000);
    assert.equal(m.forecastBalanceCents, 1_010_000 - 1_000 * 21); // media 10 €/giorno × 21
  });

  it("vengono riportati nel periodo successivo", () => {
    let ledger = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, null, 15).ledger;
    ledger = fund(ledger, "2026-10-20", 30_000).ledger;
    ledger = add(ledger, "2026-10-21", "Casa", 5_000).ledger;
    assert.equal(startBalance(ledger, "2026-11", spentByKey(ledger), TODAY), 1_025_000);
    assert.equal(computeMetrics(ledger, "2026-11", TODAY).fundsCents, 0);
  });

  it("un fondo di un periodo futuro senza altri dati non rompe i calcoli", () => {
    const ledger = fund(createDefaultLedger(), "2027-03-20", 10_000).ledger;
    assert.equal(computeMetrics(ledger, "2027-03", TODAY).fundsCents, 10_000);
    assert.equal(computeMetrics(ledger, "2026-10", TODAY).fundsCents, 0);
  });

  it("gli avvisi di superamento usano il saldo con i fondi", () => {
    let ledger = savePeriodParams(createDefaultLedger(), "2026-10", 1_000_000, 950_000, 15).ledger;
    ledger = fund(ledger, "2026-10-16", 20_000).ledger; // budget 700 €
    const out = add(ledger, "2026-10-17", "Alimentari", 71_000);
    assert.equal(out.value.periodOverrunCents, 1_000);
  });

  it("eliminazione e ordinamento", () => {
    let ledger = fund(createDefaultLedger(), "2026-10-16", 100).ledger;
    ledger = fund(ledger, "2026-10-20", 200).ledger;
    const ids = fundsForKey(ledger, "2026-10").map((f) => f.amountCents);
    assert.deepEqual(ids, [200, 100]); // dal più recente
    const first = ledger.funds[0]!;
    const result = deleteFunds(ledger, [first.id, "inesistente"]);
    assert.equal(result.value, 1);
    assert.equal(result.ledger.funds.length, 1);
  });

  it("rifiuta dati non validi", () => {
    const ledger = createDefaultLedger();
    for (const cents of [0, -5, 1.5, 10_000_000_001]) {
      assert.throws(() => fund(ledger, "2026-10-16", cents), ValidationError, String(cents));
    }
    assert.throws(() => fund(ledger, "2026-02-31", 100), ValidationError);
    assert.throws(() => addFund(ledger, { date: "2026-10-16", description: "x".repeat(121), amountCents: 100 }, deps), ValidationError);
  });

  it("non modifica lo stato precedente", () => {
    const ledger = createDefaultLedger();
    const before = serializeLedger(ledger);
    fund(ledger, "2026-10-16", 100);
    assert.equal(serializeLedger(ledger), before);
  });

  it("round-trip e compatibilità con file senza «fondi»", () => {
    const ledger = fund(createDefaultLedger(), "2026-10-16", 1_234).ledger;
    assert.deepEqual(parseBackup(serializeLedger(ledger), newId), ledger);
    const legacy = ledgerFromJson({ categorie: { Casa: "100.00" }, metodi: ["Contanti"] }, newId);
    assert.deepEqual(legacy.funds, []);
  });

  it("rifiuta fondi ostili nel file", () => {
    const row = { data: "2026-10-16", importo: "1.00" };
    const bad: unknown[] = [
      { fondi: "x" },
      { fondi: [{ ...row, importo: "NaN" }] },
      { fondi: [{ ...row, importo: 0 }] },
      { fondi: [{ ...row, importo: -3 }] },
      { fondi: [{ ...row, data: "9999-01-01" }] },
      { fondi: [{ importo: "1.00" }] },
      { fondi: [null] },
    ];
    for (const value of bad) assert.throws(() => ledgerFromJson(value, newId), AppError, JSON.stringify(value));
    const ok = ledgerFromJson({ fondi: [{ ...row, id: "dup" }, { ...row, id: "dup" }] }, newId);
    assert.equal(new Set(ok.funds.map((f) => f.id)).size, 2);
  });
});

describe("operazioni", () => {
  it("segnala i superamenti solo la prima volta", () => {
    let ledger = baseLedger();
    let out = add(ledger, "2026-10-16", "Casa", 9_000);
    assert.equal(out.value.periodOverrunCents, null);
    assert.equal(out.value.categoryAlert, null);
    ledger = out.ledger;
    out = add(ledger, "2026-10-17", "Casa", 2_000);
    assert.equal(out.value.categoryAlert?.spentCents, 11_000);
    ledger = out.ledger;
    out = add(ledger, "2026-10-18", "Casa", 1_000);
    assert.equal(out.value.categoryAlert, null); // già superata prima
    ledger = out.ledger;
    out = add(ledger, "2026-10-18", "Alimentari", 40_000);
    assert.equal(out.value.periodOverrunCents, 2_000); // 90+20+10+400 = 520 € su 500 €
  });

  it("rifiuta dati non validi", () => {
    const ledger = baseLedger();
    assert.throws(() => add(ledger, "2026-10-16", "Inventata", 100), ValidationError);
    assert.throws(() => add(ledger, "2026-10-16", "Casa", 0), ValidationError);
    assert.throws(() => add(ledger, "2026-10-16", "Casa", 1.5), ValidationError);
    assert.throws(() => add(ledger, "2026-02-31", "Casa", 100), ValidationError);
    assert.throws(
      () => addMovement(ledger, { date: "2026-10-16", description: "", category: "Casa", method: "Assegno", amountCents: 1 }, deps),
      ValidationError,
    );
  });

  it("non modifica mai lo stato precedente (immutabilità)", () => {
    const ledger = baseLedger();
    const before = serializeLedger(ledger);
    add(ledger, "2026-10-16", "Casa", 100);
    upsertCategory(ledger, "Nuova", 100);
    assert.equal(serializeLedger(ledger), before);
  });

  it("elimina movimenti", () => {
    const first = add(baseLedger(), "2026-10-16", "Casa", 100);
    const result = deleteMovements(first.ledger, [first.value.movement.id, "inesistente"]);
    assert.equal(result.value, 1);
    assert.equal(result.ledger.movements.length, 0);
  });

  it("gestisce categorie e metodi", () => {
    let ledger = upsertCategory(createDefaultLedger(), "  Viaggi ", 12_345).ledger;
    assert.equal(ledger.categories.at(-1)?.name, "Viaggi");
    ledger = upsertCategory(ledger, "Viaggi", 500).ledger;
    assert.equal(ledger.categories.filter((c) => c.name === "Viaggi").length, 1);
    assert.equal(ledger.categories.at(-1)?.budgetCents, 500);
    assert.throws(() => upsertCategory(ledger, "X", -1), ValidationError);
    assert.throws(() => deleteCategory(ledger, "Nessuna"), ValidationError);
    assert.throws(() => reorderCategories(ledger, ["Casa"]), ValidationError);
    ledger = sortCategories(ledger).ledger;
    assert.deepEqual(ledger.categories.map((c) => c.name), [...ledger.categories.map((c) => c.name)].sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" })));
    assert.throws(() => addMethod(ledger, "Contanti"), ValidationError);
    assert.ok(addMethod(ledger, "Satispay").ledger.methods.includes("Satispay"));
  });

  it("giorno stipendio valido", () => {
    for (const bad of [0, 29, "x", "", 1.5]) {
      assert.throws(() => savePeriodParams(createDefaultLedger(), "2026-10", 0, 0, bad), ValidationError);
    }
    assert.throws(() => savePeriodParams(createDefaultLedger(), "../x", 0, 0, 15), ValidationError);
  });
});

describe("serializzazione", () => {
  it("round-trip identico", () => {
    let ledger = baseLedger();
    ledger = add(ledger, "2026-10-16", "Casa", 1_234).ledger;
    const restored = parseBackup(serializeLedger(ledger), newId);
    assert.deepEqual(restored, ledger);
  });

  it("legge il file dell'app desktop (importi numerici o stringa)", () => {
    const legacy = {
      giorno_inizio: 15,
      categorie: { Casa: 100, Svago: "20.50" },
      metodi: ["Contanti"],
      mesi: { "2026-10": { saldo_iniziale: 7026.5 } },
      movimenti: [{ id: "abc", data: "2026-10-06", descrizione: "x", categoria: "Casa", metodo: "Contanti", importo: 13.3 }],
    };
    const ledger = ledgerFromJson(legacy, newId);
    assert.equal(ledger.movements[0]?.amountCents, 1_330);
    assert.equal(ledger.overrides["2026-10"]?.startBalanceCents, 702_650);
    assert.equal(ledger.categories[1]?.budgetCents, 2_050);
  });

  it("rigenera id mancanti o duplicati", () => {
    const row = { data: "2026-10-06", categoria: "A", metodo: "B", importo: "1.00" };
    const ledger = ledgerFromJson({ movimenti: [{ ...row, id: "dup" }, { ...row, id: "dup" }, row] }, newId);
    assert.equal(new Set(ledger.movements.map((m) => m.id)).size, 3);
  });

  it("rifiuta valori ostili", () => {
    const row = { data: "2026-10-06", categoria: "A", metodo: "B", importo: "1.00" };
    const bad: unknown[] = [
      [],
      "testo",
      null,
      { movimenti: [{ ...row, importo: "NaN" }] },
      { movimenti: [{ ...row, importo: -1 }] },
      { movimenti: [{ ...row, importo: true }] },
      { movimenti: [{ ...row, data: "9999-10-06" }] },
      { movimenti: [{ ...row, categoria: "" }] },
      { movimenti: "x" },
      { categorie: { A: "1e999" } },
      { categorie: { A: -1 } },
      { mesi: { "../etc": {} } },
      { mesi: { __proto__x: {} } },
      { giorno_inizio: 31 },
    ];
    for (const value of bad) {
      assert.throws(() => ledgerFromJson(value, newId), AppError, JSON.stringify(value));
    }
    assert.throws(() => parseBackup("{non json", newId), ValidationError);
    assert.throws(() => parseBackup(" ".repeat(20_000_001), newId), ValidationError);
  });

  it("ignora __proto__ e non inquina i prototipi", () => {
    const payload = '{"categorie":{"__proto__":"5.00","Casa":"1.00"},"mesi":{},"__proto__":{"polluted":true}}';
    const ledger = parseBackup(payload, newId);
    assert.equal(({} as Record<string, unknown>)["polluted"], undefined);
    assert.equal(ledger.categories.find((c) => c.name === "__proto__")?.budgetCents, 500);
    const exported = serializeLedger(ledger);
    assert.ok(exported.includes('"__proto__": "5.00"'));
    assert.deepEqual(parseBackup(exported, newId).categories, ledger.categories);
  });
});
