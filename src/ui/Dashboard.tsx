import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  categoryTotals,
  computeMetrics,
  formatEur,
  formatInput,
  formatPercentTenths,
  parseAmount,
  savePeriodParams,
} from "../core/index.ts";
import { useApp } from "../state/AppContext.tsx";
import { Donut } from "./components/Donut.tsx";
import { Field } from "./components/Field.tsx";
import { Kpi, type Tone } from "./components/Kpi.tsx";

export function Dashboard({ periodKey }: { periodKey: string }) {
  const { ledger, today, commit } = useApp();
  const m = useMemo(() => computeMetrics(ledger, periodKey, today), [ledger, periodKey, today]);
  const totals = useMemo(() => categoryTotals(ledger, periodKey), [ledger, periodKey]);

  const [startText, setStartText] = useState("");
  const [minText, setMinText] = useState("");
  const [dayText, setDayText] = useState("");
  useEffect(() => {
    setStartText(formatInput(m.startBalanceCents));
    setMinText(formatInput(m.minBalanceCents));
    setDayText(String(ledger.payDay));
  }, [m.startBalanceCents, m.minBalanceCents, ledger.payDay, periodKey]);

  async function saveParams(event: FormEvent): Promise<void> {
    event.preventDefault();
    await commit((l) => savePeriodParams(l, periodKey, parseAmount(startText), parseAmount(minText), dayText));
  }

  const percentTone: Tone = m.percentTenths > 1000 ? "bad" : m.percentTenths >= 800 ? "warn" : "ok";
  const forecastOk = m.forecastBalanceCents >= m.minBalanceCents;
  const top = m.topMovement;

  const budgeted = new Set(ledger.categories.map((c) => c.name));
  const rows = [
    ...ledger.categories.map((c) => ({ name: c.name, budget: c.budgetCents as number | null })),
    ...[...totals.keys()].filter((name) => !budgeted.has(name)).map((name) => ({ name, budget: null })),
  ];
  const chartItems = [...totals.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  return (
    <section aria-label="Dashboard">
      {m.overBudget ? (
        <div className="banner banner-bad" role="alert">
          ⚠ Budget superato di {formatEur(-m.remainingBudgetCents)}
        </div>
      ) : m.percentTenths >= 800 ? (
        <div className="banner banner-warn">● Attenzione: hai usato il {Math.round(m.percentTenths / 10)}% del budget</div>
      ) : (
        <div className="banner banner-ok">✓ Sei nel budget</div>
      )}

      <form className="card params" onSubmit={(event) => void saveParams(event)}>
        <div className="params-title">
          <strong>Parametri del periodo</strong>
          <span className="muted">Saldo, soglia minima e stipendio</span>
        </div>
        <Field label="Saldo a inizio periodo (€)">
          <input inputMode="decimal" value={startText} onChange={(e) => setStartText(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Saldo minimo desiderato (€)">
          <input inputMode="decimal" value={minText} onChange={(e) => setMinText(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Giorno stipendio" className="narrow">
          <input inputMode="numeric" value={dayText} onChange={(e) => setDayText(e.target.value)} autoComplete="off" />
        </Field>
        <button type="submit" className="primary">
          Salva
        </button>
      </form>

      <div className="kpis">
        <Kpi title="Saldo attuale" value={formatEur(m.currentBalanceCents)} sub="dopo le spese registrate" />
        <Kpi title="Saldo minimo" value={formatEur(m.minBalanceCents)} sub="soglia da non scendere sotto" />
        <Kpi title="Budget spendibile" value={formatEur(m.budgetCents)} sub="saldo iniziale − minimo" />
        <Kpi title="Spese del periodo" value={formatEur(m.spentCents)} sub={`${m.movementCount} movimenti`} />
        <Kpi
          title="Budget residuo"
          value={formatEur(m.remainingBudgetCents)}
          sub={m.overBudget ? "superato!" : "ancora disponibile"}
          tone={m.remainingBudgetCents < 0 ? "bad" : "neutral"}
        />
        <Kpi title="% budget utilizzata" value={formatPercentTenths(m.percentTenths)} sub="del budget" tone={percentTone} />
        <Kpi
          title="Saldo previsto a fine periodo"
          value={formatEur(m.forecastBalanceCents)}
          sub={forecastOk ? "in linea col minimo" : "sotto il minimo!"}
          tone={forecastOk ? "neutral" : "bad"}
        />
        <Kpi title="Spesa media giornaliera" value={formatEur(m.dailyAverageCents)} sub="sui giorni trascorsi" />
        {m.dailyBudgetLeftCents === null ? (
          <Kpi title="Budget giornaliero residuo" value="—" sub="periodo concluso" />
        ) : (
          <Kpi
            title="Budget giornaliero residuo"
            value={formatEur(m.dailyBudgetLeftCents)}
            sub={`per ${m.daysRemaining} giorni rimasti`}
            tone={m.dailyBudgetLeftCents < 0 ? "bad" : "neutral"}
          />
        )}
        <Kpi
          title="Spesa più alta"
          value={top ? formatEur(top.amountCents) : "—"}
          sub={top ? (top.description || top.category).slice(0, 28) : "nessuna spesa"}
        />
      </div>

      <div
        className={`progress tone-${percentTone}`}
        role="progressbar"
        aria-label="Budget utilizzato"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(m.percentTenths / 10))}
      >
        <div style={{ width: `${Math.min(100, m.percentTenths / 10)}%` }} />
      </div>

      <div className="two-col">
        <div className="card">
          <h2 className="section-title">Spese per categoria</h2>
          <ul className="cat-rows">
            {rows.map(({ name, budget }) => {
              const spent = totals.get(name) ?? 0;
              const over = budget !== null && spent > budget;
              const warn = budget !== null && !over && spent * 5 >= budget * 4;
              const tone: Tone = budget === null ? "neutral" : over ? "bad" : warn ? "warn" : "ok";
              const width = budget === null ? 0 : budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;
              return (
                <li key={name}>
                  <div className="cat-head">
                    <strong>{name}</strong>
                    <span className={`tone-${tone}`}>
                      {budget === null ? `${formatEur(spent)} (senza budget)` : `${formatEur(spent)} / ${formatEur(budget)}`}
                    </span>
                  </div>
                  <div className={`progress thin tone-${tone}`}>
                    <div style={{ width: `${width}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card">
          <h2 className="section-title">Distribuzione delle spese</h2>
          <Donut items={chartItems} />
        </div>
      </div>
    </section>
  );
}
