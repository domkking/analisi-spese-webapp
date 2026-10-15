/** Test della logica (nessun browser): `npm test` — usa il test runner integrato di Node. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addMethod,
  addMovement,
  AppError,
  centsToDecimalString,
  cleanText,
  computeMetrics,
  createDefaultLedger,
  currentKey,
  deleteCategory,
  deleteMovements,
  divRound,
  formatDateIt,
  formatEur,
  formatPercentTenths,
  formatPeriodLabel,
  keyForDate,
  ledgerFromJson,
  parseAmount,
  parseBackup,
  parseIsoDate,
  periodBounds,
  reorderCategories,
  savePeriodParams,
  serializeLedger,
  shiftKey,
  sortCategories,
  startBalance,
  spentByKey,
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
    assert.equal(computeMetrics(ledger, "2026-11", TODAY).minBalanceCents, 950_000);
  });

  it("budget non positivo", () => {
    const ledger = savePeriodParams(createDefaultLedger(), "2026-10", 100, 500, 15).ledger;
    assert.equal(computeMetrics(ledger, "2026-10", TODAY).percentTenths, 0);
    const spent = add(ledger, "2026-10-16", "Casa", 1).ledger;
    assert.equal(computeMetrics(spent, "2026-10", TODAY).percentTenths, 1000);
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
