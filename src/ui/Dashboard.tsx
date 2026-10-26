import { useMemo, useState, type FormEvent } from "react";

import {
  categoryTotals,
  computeMetrics,
  formatEur,
  formatInput,
  formatPercentTenths,
  parseAmount,
  plural,
  savePeriodParams,
  totalCategoryBudget,
  type PeriodMetrics,
} from "../core/index.ts";
import { useApp } from "../state/AppContext.tsx";
import { Donut } from "./components/Donut.tsx";
import { Field } from "./components/Field.tsx";
import { Kpi, type Tone } from "./components/Kpi.tsx";

interface ParamsFormProps {
  periodKey: string;
  metrics: PeriodMetrics;
  payDay: number;
  totalBudget: number;
}

/**
 * Parametri del periodo. Lo stato nasce dai valori salvati; quando questi cambiano il componente viene
 * ricreato (prop `key`), quindi non servono effetti di sincronizzazione e non si "perde" ciò che si digita.
 */
function ParamsForm({ periodKey, metrics: m, payDay, totalBudget }: ParamsFormProps) {
  const { commit } = useApp();
  const [startText, setStartText] = useState(() => formatInput(m.startBalanceCents));
  const [minText, setMinText] = useState(() => formatInput(m.minBalanceCents));
  const [minManual, setMinManual] = useState(() => !m.minBalanceIsAuto);
  const [dayText, setDayText] = useState(() => String(payDay));

  /** Finché il minimo è automatico, segue il saldo che stai digitando: saldo + fondi − totale budget. */
  function autoMinFor(startValue: string): string {
    try {
      return formatInput(parseAmount(startValue) + m.fundsCents - totalBudget);
    } catch {
      return minText; // saldo non ancora valido: lascia com'è
    }
  }

  function changeStart(value: string): void {
    setStartText(value);
    if (!minManual) setMinText(autoMinFor(value));
  }

  function changeMin(value: string): void {
    setMinText(value);
    setMinManual(true);
  }

  function restoreAuto(): void {
    setMinManual(false);
    setMinText(autoMinFor(startText));
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    await commit((l) =>
      savePeriodParams(l, periodKey, parseAmount(startText), minManual ? parseAmount(minText) : null, dayText),
    );
  }

  return (
    <form className="card params" onSubmit={(event) => void save(event)}>
      <div className="params-title">
        <strong>Parametri del periodo</strong>
        <span className="muted">Saldo, soglia minima e stipendio</span>
      </div>
      <Field label="Saldo a inizio periodo (€)">
        <input inputMode="decimal" value={startText} onChange={(e) => changeStart(e.target.value)} autoComplete="off" />
      </Field>
      <Field
        label={
          <>
            Saldo minimo desiderato (€)
            <span className={`badge${minManual ? " manual" : ""}`}>{minManual ? "Manuale" : "Auto"}</span>
          </>
        }
      >
        <input inputMode="decimal" value={minText} onChange={(e) => changeMin(e.target.value)} autoComplete="off" />
      </Field>
      {minManual && (
        <button type="button" className="ghost" onClick={restoreAuto}>
          Ripristina automatico
        </button>
      )}
      <Field label="Giorno stipendio" className="narrow">
        <input inputMode="numeric" value={dayText} onChange={(e) => setDayText(e.target.value)} autoComplete="off" />
      </Field>
      <button type="submit" className="primary">
        Salva
      </button>
      <p className={`muted params-note${m.minBalanceCents < 0 ? " tone-bad" : ""}`}>
        {m.minBalanceCents < 0
          ? "Attenzione: i budget delle categorie superano il saldo disponibile (il minimo risulta negativo)."
          : minManual
            ? `Minimo impostato a mano. Automatico: ${formatEur(m.autoMinBalanceCents)} (saldo iniziale${m.fundsCents > 0 ? " + fondi" : ""} − totale budget ${formatEur(totalBudget)}).`
            : `Minimo automatico: saldo iniziale${m.fundsCents > 0 ? ` + fondi (${formatEur(m.fundsCents)})` : ""} − totale budget (${formatEur(totalBudget)}). Scrivi un valore per impostarlo a mano.`}
      </p>
    </form>
  );
}

export function Dashboard({ periodKey }: { periodKey: string }) {
  const { ledger, today } = useApp();
  const m = useMemo(() => computeMetrics(ledger, periodKey, today), [ledger, periodKey, today]);
  const totals = useMemo(() => categoryTotals(ledger, periodKey), [ledger, periodKey]);

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

      <ParamsForm
        key={`${periodKey}|${m.startBalanceCents}|${m.fundsCents}|${m.minBalanceCents}|${m.minBalanceIsAuto}|${ledger.payDay}`}
        periodKey={periodKey}
        metrics={m}
        payDay={ledger.payDay}
        totalBudget={totalCategoryBudget(ledger)}
      />

      <div className="kpis">
        <Kpi title="Saldo attuale" value={formatEur(m.currentBalanceCents)} sub={m.fundsCents > 0 ? "dopo spese e fondi" : "dopo le spese registrate"} />
        <Kpi title="Saldo minimo" value={formatEur(m.minBalanceCents)} sub="soglia da non scendere sotto" />
        <Kpi title="Budget spendibile" value={formatEur(m.budgetCents)} sub={m.fundsCents > 0 ? "saldo + fondi − minimo" : "saldo iniziale − minimo"} />
        <Kpi title="Fondi aggiunti" value={m.fundsCents > 0 ? `+${formatEur(m.fundsCents)}` : formatEur(0)} sub={plural(m.fundCount, "versamento", "versamenti")} tone={m.fundsCents > 0 ? "ok" : "neutral"} />
        <Kpi title="Spese del periodo" value={formatEur(m.spentCents)} sub={plural(m.movementCount, "movimento", "movimenti")} />
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
