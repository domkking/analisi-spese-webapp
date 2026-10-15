import { useState } from "react";

import { currentKey, formatPeriodLabel, periodBounds, shiftKey } from "../core/index.ts";
import { useApp } from "../state/AppContext.tsx";
import { Notices } from "./components/Notices.tsx";
import { Categories } from "./Categories.tsx";
import { Dashboard } from "./Dashboard.tsx";
import { DataPage } from "./DataPage.tsx";
import { Help } from "./Help.tsx";
import { Transactions } from "./Transactions.tsx";

type TabId = "dashboard" | "movimenti" | "categorie" | "dati" | "istruzioni";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "movimenti", label: "Movimenti" },
  { id: "categorie", label: "Categorie & Budget" },
  { id: "dati", label: "Dati" },
  { id: "istruzioni", label: "Istruzioni" },
];

export function App() {
  const { ledger, today } = useApp();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [periodKey, setPeriodKey] = useState(() => currentKey(ledger, today));

  const { start, end } = periodBounds(periodKey, ledger.payDay);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Analisi Spese</h1>
        <div className="period-nav" role="group" aria-label="Periodo">
          <button type="button" className="icon-btn boxed" aria-label="Periodo precedente" onClick={() => setPeriodKey(shiftKey(periodKey, -1))}>
            ‹
          </button>
          <span className="period-label" aria-live="polite">
            {formatPeriodLabel(start, end)}
          </span>
          <button type="button" className="icon-btn boxed" aria-label="Periodo successivo" onClick={() => setPeriodKey(shiftKey(periodKey, 1))}>
            ›
          </button>
          <button type="button" className="primary small" onClick={() => setPeriodKey(currentKey(ledger, today))}>
            Oggi
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sezioni">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "dashboard" && <Dashboard periodKey={periodKey} />}
        {tab === "movimenti" && <Transactions periodKey={periodKey} onPeriodChange={setPeriodKey} />}
        {tab === "categorie" && <Categories />}
        {tab === "dati" && <DataPage />}
        {tab === "istruzioni" && <Help />}
      </main>

      <footer className="app-footer">Strumento di consultazione personale: non costituisce consulenza finanziaria.</footer>
      <Notices />
    </div>
  );
}
