import { useState, type FormEvent } from "react";

import {
  addMethod,
  deleteCategory,
  deleteMethod,
  formatEur,
  formatInput,
  parseAmount,
  reorderCategories,
  reorderMethods,
  sortCategories,
  sortMethods,
  totalCategoryBudget,
  upsertCategory,
} from "../core/index.ts";
import { useApp } from "../state/AppContext.tsx";
import { useConfirm } from "./components/Confirm.tsx";
import { Field } from "./components/Field.tsx";
import { SortableList } from "./components/SortableList.tsx";

export function Categories() {
  const { ledger, commit } = useApp();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [method, setMethod] = useState("");

  async function saveCategory(event: FormEvent): Promise<void> {
    event.preventDefault();
    const saved = await commit((l) => ({ ...upsertCategory(l, name, parseAmount(budget)), value: true }));
    if (saved) {
      setName("");
      setBudget("");
      setSelected(null);
    }
  }

  function pickCategory(id: string): void {
    const found = ledger.categories.find((c) => c.name === id);
    if (!found) return;
    setSelected(id);
    setName(found.name);
    setBudget(formatInput(found.budgetCents));
  }

  async function removeCategory(id: string): Promise<void> {
    const ok = await confirm({
      title: `Eliminare la categoria «${id}»?`,
      message: "I movimenti già registrati con questa categoria restano, ma la categoria non avrà più un budget.",
      confirmLabel: "Elimina",
      tone: "danger",
    });
    if (!ok) return;
    await commit((l) => deleteCategory(l, id));
    if (selected === id) setSelected(null);
  }

  async function saveMethod(event: FormEvent): Promise<void> {
    event.preventDefault();
    const added = await commit((l) => ({ ...addMethod(l, method), value: true }));
    if (added) setMethod("");
  }

  async function removeMethod(id: string): Promise<void> {
    const ok = await confirm({
      title: `Eliminare il metodo «${id}»?`,
      message: "I movimenti già registrati con questo metodo restano.",
      confirmLabel: "Elimina",
      tone: "danger",
    });
    if (!ok) return;
    await commit((l) => deleteMethod(l, id));
  }

  return (
    <section aria-label="Categorie e budget" className="two-col">
      <div className="card">
        <div className="panel-head">
          <div>
            <h2 className="section-title">Categorie e budget</h2>
            <p className="muted">Trascina le righe o usa ▲▼ per riordinarle</p>
          </div>
          <button type="button" className="ghost" onClick={() => void commit(sortCategories)}>
            Ordina A–Z
          </button>
        </div>
        <SortableList
          label="Categorie"
          emptyText="Nessuna categoria: aggiungine una qui sotto."
          items={ledger.categories.map((c) => ({ id: c.name, primary: c.name, secondary: formatEur(c.budgetCents) }))}
          selectedId={selected}
          onReorder={(order) => void commit((l) => reorderCategories(l, order))}
          onSelect={pickCategory}
          onDelete={(id) => void removeCategory(id)}
        />
        <div className="summary">
          <span>TOTALE BUDGET</span>
          <strong>{formatEur(totalCategoryBudget(ledger))}</strong>
        </div>
        <form className="inline-form" onSubmit={(event) => void saveCategory(event)}>
          <Field label="Nome categoria" className="grow">
            <input maxLength={40} required placeholder="Es. Alimentazione" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Budget (€)" className="narrow">
            <input inputMode="decimal" required placeholder="0,00" value={budget} onChange={(e) => setBudget(e.target.value)} autoComplete="off" />
          </Field>
          <button type="submit" className="primary">
            Salva
          </button>
        </form>
      </div>

      <div className="card">
        <div className="panel-head">
          <div>
            <h2 className="section-title">Metodi di pagamento</h2>
            <p className="muted">Trascina le righe o usa ▲▼ per riordinarle</p>
          </div>
          <button type="button" className="ghost" onClick={() => void commit(sortMethods)}>
            Ordina A–Z
          </button>
        </div>
        <SortableList
          label="Metodi di pagamento"
          emptyText="Nessun metodo: aggiungine uno qui sotto."
          items={ledger.methods.map((m) => ({ id: m, primary: m }))}
          onReorder={(order) => void commit((l) => reorderMethods(l, order))}
          onDelete={(id) => void removeMethod(id)}
        />
        <div className="summary">
          <span>METODI ATTIVI</span>
          <strong>{ledger.methods.length}</strong>
        </div>
        <form className="inline-form" onSubmit={(event) => void saveMethod(event)}>
          <Field label="Nuovo metodo" className="grow">
            <input maxLength={40} required placeholder="Es. Satispay" value={method} onChange={(e) => setMethod(e.target.value)} autoComplete="off" />
          </Field>
          <button type="submit" className="primary">
            Aggiungi
          </button>
        </form>
      </div>
    </section>
  );
}
