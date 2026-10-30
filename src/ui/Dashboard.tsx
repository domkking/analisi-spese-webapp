import { useMemo, useState, type FormEvent } from "react";

import {
  categoryOverview,
  computeMetrics,
  formatEur,
  formatInput,
  formatPercentTenths,
  parseAmount,
  pickTopCategories,
  plural,
  savePeriodParams,
  totalCategoryBudget,
  type CategoryRow,
  type PeriodMetrics,
} from "../core/index.ts";
import { useApp } from "../state/AppContext.tsx";
import { usePersistentFlag } from "../state/uiPrefs.ts";
import { Collapsible } from "./components/Collapsible.tsx";
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
    <form className="params" onSubmit={(event) => void save(event)}>
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
      <p className="muted params-note">
        {minManual
          ? `Minimo impostato a mano. Automatico: ${formatEur(m.autoMinBalanceCents)} (saldo iniziale${m.fundsCents > 0 ? " + fondi" : ""} − totale budget ${formatEur(totalBudget)}).`
          : `Minimo automatico: saldo iniziale${m.fundsCents > 0 ? ` + fondi (${formatEur(m.fundsCents)})` : ""} − totale budget (${formatEur(totalBudget)}). Scrivi un valore per impostarlo a mano.`}
      </p>
    </form>
  );
}

/** Quanto resta del budget: il dato principale della home, con barra di avanzamento e budget giornaliero. */
function Hero({ m }: { m: PeriodMetrics }) {
  const tone: Tone = m.overBudget ? "bad" : m.percentTenths >= 800 ? "warn" : "ok";
  const width = Math.min(100, m.percentTenths / 10);
  return (
    <div className="card hero">
      <div className="kpi-title">Budget residuo</div>
      <div className={`hero-value${m.remainingBudgetCents < 0 ? " tone-bad" : ""}`}>{formatEur(m.remainingBudgetCents)}</div>
      <div className="hero-sub">
        su {formatEur(m.budgetCents)} · {formatPercentTenths(m.percentTenths)} utilizzato
      </div>
      <div
        className={`progress tone-${tone}`}
        role="progressbar"
        aria-label="Budget utilizzato"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
      >
        <div style={{ width: `${width}%` }} />
      </div>
      <div className={`hero-foot${m.dailyBudgetLeftCents !== null && m.dailyBudgetLeftCents < 0 ? " tone-bad" : ""}`}>
        {m.dailyBudgetLeftCents === null
          ? "Periodo concluso"
          : `${formatEur(m.dailyBudgetLeftCents)} al giorno per ${plural(m.daysRemaining, "giorno", "giorni")}`}
      </div>
    </div>
  );
}

/** Spese per categoria: di default solo le principali (dove si è speso), le altre su richiesta. */
function CategoryPanel({ rows }: { rows: readonly CategoryRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const { shown } = pickTopCategories(rows, 5);
  const visible = showAll ? rows : shown;
  return (
    <div className="card dash-categories">
      <h2 className="section-title">{showAll ? "Tutte le categorie" : "Dove stai spendendo"}</h2>
      {visible.length === 0 ? (
        <p className="muted">Nessuna spesa registrata in questo periodo.</p>
      ) : (
        <ul className="cat-rows">
          {visible.map(({ name, budgetCents: budget, spentCents: spent }) => {
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
      )}
      {(rows.length > shown.length || showAll) && rows.length > 0 && (
        <button type="button" className="ghost show-all" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Mostra solo le principali" : `Mostra tutte le categorie (${rows.length})`}
        </button>
      )}
    </div>
  );
}

export function Dashboard({ periodKey }: { periodKey: string }) {
  const { ledger, today } = useApp();
  const m = useMemo(() => computeMetrics(ledger, periodKey, today), [ledger, periodKey, today]);
  const overview = useMemo(() => categoryOverview(ledger, periodKey), [ledger, periodKey]);
  const [detailsOpen, setDetailsOpen] = usePersistentFlag("dash.details", false);
  const [chartOpen, setChartOpen] = usePersistentFlag("dash.chart", false);
  const [paramsOpen, setParamsOpen] = usePersistentFlag("dash.params", false);

  const isNew = Object.keys(ledger.overrides).length === 0 && ledger.movements.length === 0 && ledger.funds.length === 0;
  const forecastOk = m.forecastBalanceCents >= m.minBalanceCents;
  const top = m.topMovement;
  const chartItems = overview
    .filter((row) => row.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents)
    .map((row) => ({ label: row.name, value: row.spentCents }));

  function openParams(): void {
    setParamsOpen(true);
    window.setTimeout(() => document.getElementById("section-params")?.scrollIntoView({ block: "start" }), 50);
  }

  return (
    <section aria-label="Dashboard" className="dashboard">
      {m.overBudget ? (
        <div className="banner banner-bad" role="alert">
          ⚠ Budget superato di {formatEur(-m.remainingBudgetCents)}
        </div>
      ) : m.percentTenths >= 800 ? (
        <div className="banner banner-warn">● Attenzione: hai usato il {Math.round(m.percentTenths / 10)}% del budget</div>
      ) : (
        <div className="banner banner-ok">✓ Sei nel budget</div>
      )}
      {m.minBalanceCents < 0 && (
        <div className="banner banner-warn">Attenzione: i budget delle categorie superano il saldo disponibile (il minimo risulta negativo).</div>
      )}
      {isNew && (
        <div className="banner banner-info">
          <span>Per iniziare imposta il saldo a inizio periodo.</span>
          <button type="button" className="primary small" onClick={openParams}>
            Imposta saldo
          </button>
        </div>
      )}

      <div className="dash-grid">
        <div className="dash-main">
          <Hero m={m} />
          <div className="quick-kpis">
            <Kpi
              title="Spese di oggi"
              value={m.todayInPeriod ? formatEur(m.todaySpentCents) : "—"}
              sub={
                !m.todayInPeriod
                  ? "oggi non è in questo periodo"
                  : m.todayMovementCount === 0
                    ? "nessuna spesa oggi"
                    : plural(m.todayMovementCount, "movimento", "movimenti")
              }
            />
            <Kpi title="Saldo attuale" value={formatEur(m.currentBalanceCents)} sub={m.fundsCents > 0 ? "dopo spese e fondi" : "dopo le spese registrate"} />
            <Kpi
              title="Previsto a fine periodo"
              value={formatEur(m.forecastBalanceCents)}
              sub={forecastOk ? "in linea col minimo" : "sotto il minimo!"}
              tone={forecastOk ? "neutral" : "bad"}
            />
          </div>
        </div>
        <CategoryPanel rows={overview} />
      </div>

      <Collapsible id="details" title="Dettagli del periodo" open={detailsOpen} onToggle={setDetailsOpen}>
        <div className="kpis">
          <Kpi title="Saldo minimo" value={formatEur(m.minBalanceCents)} sub={m.minBalanceIsAuto ? "automatico" : "impostato a mano"} />
          <Kpi title="Budget spendibile" value={formatEur(m.budgetCents)} sub={m.fundsCents > 0 ? "saldo + fondi − minimo" : "saldo iniziale − minimo"} />
          <Kpi
            title="Fondi aggiunti"
            value={m.fundsCents > 0 ? `+${formatEur(m.fundsCents)}` : formatEur(0)}
            sub={plural(m.fundCount, "versamento", "versamenti")}
            tone={m.fundsCents > 0 ? "ok" : "neutral"}
          />
          <Kpi title="Spese del periodo" value={formatEur(m.spentCents)} sub={plural(m.movementCount, "movimento", "movimenti")} />
          <Kpi title="Spesa media giornaliera" value={formatEur(m.dailyAverageCents)} sub="sui giorni trascorsi" />
          <Kpi
            title="Spesa più alta"
            value={top ? formatEur(top.amountCents) : "—"}
            sub={top ? (top.description || top.category).slice(0, 28) : "nessuna spesa"}
          />
        </div>
      </Collapsible>

      <Collapsible id="chart" title="Distribuzione delle spese" open={chartOpen} onToggle={setChartOpen}>
        <Donut items={chartItems} />
      </Collapsible>

      <Collapsible
        id="params"
        title="Parametri del periodo"
        summary={`Saldo ${formatEur(m.startBalanceCents)} · Minimo ${formatEur(m.minBalanceCents)}${m.minBalanceIsAuto ? " (auto)" : ""}`}
        open={paramsOpen}
        onToggle={setParamsOpen}
      >
        <ParamsForm
          key={`${periodKey}|${m.startBalanceCents}|${m.fundsCents}|${m.minBalanceCents}|${m.minBalanceIsAuto}|${ledger.payDay}`}
          periodKey={periodKey}
          metrics={m}
          payDay={ledger.payDay}
          totalBudget={totalCategoryBudget(ledger)}
        />
      </Collapsible>
    </section>
  );
}
