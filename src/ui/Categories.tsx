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
  updateCategory,
  updateMethod,
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
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  // se l'elemento in modifica non esiste più (es. eliminato da un'altra scheda) si torna a «nuovo»
  const editingCategory = selected !== null && ledger.categories.some((c) => c.name === selected) ? selected : null;
  const editingMethod = selectedMethod !== null && ledger.methods.includes(selectedMethod) ? selectedMethod : null;

  function resetCategoryForm(): void {
    setSelected(null);
    setName("");
    setBudget("");
  }

  function resetMethodForm(): void {
    setSelectedMethod(null);
    setMethod("");
  }

  async function saveCategory(event: FormEvent): Promise<void> {
    event.preventDefault();
    const saved = await commit((l) => {
      const cents = parseAmount(budget);
      const change = editingCategory !== null ? updateCategory(l, editingCategory, name, cents) : upsertCategory(l, name, cents);
      return { ...change, value: true };
    });
    if (saved) resetCategoryForm();
  }

  function pickCategory(id: string): void {
    if (editingCategory === id) {
      resetCategoryForm();
      return;
    }
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
    if (selected === id) resetCategoryForm();
  }

  async function saveMethod(event: FormEvent): Promise<void> {
    event.preventDefault();
    const saved = await commit((l) => ({
      ...(editingMethod !== null ? updateMethod(l, editingMethod, method) : addMethod(l, method)),
      value: true,
    }));
    if (saved) resetMethodForm();
  }

  function pickMethod(id: string): void {
    if (editingMethod === id) {
      resetMethodForm();
      return;
    }
    setSelectedMethod(id);
    setMethod(id);
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
    if (selectedMethod === id) resetMethodForm();
  }

  return (
    <section aria-label="Categorie e budget" className="two-col">
      <div className="card">
        <div className="panel-head">
          <div>
            <h2 className="section-title">Categorie e budget</h2>
            <p className="muted">Clicca una riga per modificarla · trascina o usa ▲▼ per riordinare</p>
          </div>
          <button type="button" className="ghost" onClick={() => void commit(sortCategories)}>
            Ordina A–Z
          </button>
        </div>
        <SortableList
          label="Categorie"
          emptyText="Nessuna categoria: aggiungine una qui sotto."
          items={ledger.categories.map((c) => ({ id: c.name, primary: c.name, secondary: formatEur(c.budgetCents) }))}
          selectedId={editingCategory}
          onReorder={(order) => void commit((l) => reorderCategories(l, order))}
          onSelect={pickCategory}
          onDelete={(id) => void removeCategory(id)}
        />
        <div className="summary">
          <span>TOTALE BUDGET</span>
          <strong>{formatEur(totalCategoryBudget(ledger))}</strong>
        </div>
        <form className={`inline-form${editingCategory !== null ? " editing-card" : ""}`} onSubmit={(event) => void saveCategory(event)}>
          <h3 className="form-title">{editingCategory !== null ? `Modifica «${editingCategory}»` : "Nuova categoria"}</h3>
          <Field label="Nome categoria" className="grow">
            <input maxLength={40} required placeholder="Es. Alimentazione" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Budget (€)" className="narrow">
            <input inputMode="decimal" required placeholder="0,00" value={budget} onChange={(e) => setBudget(e.target.value)} autoComplete="off" />
          </Field>
          <button type="submit" className="primary">
            {editingCategory !== null ? "Salva modifiche" : "Salva"}
          </button>
          {editingCategory !== null && (
            <button type="button" className="ghost cancel-edit" onClick={resetCategoryForm}>
              Annulla
            </button>
          )}
        </form>
      </div>

      <div className="card">
        <div className="panel-head">
          <div>
            <h2 className="section-title">Metodi di pagamento</h2>
            <p className="muted">Clicca una riga per rinominarla · trascina o usa ▲▼ per riordinare</p>
          </div>
          <button type="button" className="ghost" onClick={() => void commit(sortMethods)}>
            Ordina A–Z
          </button>
        </div>
        <SortableList
          label="Metodi di pagamento"
          emptyText="Nessun metodo: aggiungine uno qui sotto."
          items={ledger.methods.map((m) => ({ id: m, primary: m }))}
          selectedId={editingMethod}
          onReorder={(order) => void commit((l) => reorderMethods(l, order))}
          onSelect={pickMethod}
          onDelete={(id) => void removeMethod(id)}
        />
        <div className="summary">
          <span>METODI ATTIVI</span>
          <strong>{ledger.methods.length}</strong>
        </div>
        <form className={`inline-form${editingMethod !== null ? " editing-card" : ""}`} onSubmit={(event) => void saveMethod(event)}>
          <h3 className="form-title">{editingMethod !== null ? `Rinomina «${editingMethod}»` : "Nuovo metodo"}</h3>
          <Field label="Nome del metodo" className="grow">
            <input maxLength={40} required placeholder="Es. Satispay" value={method} onChange={(e) => setMethod(e.target.value)} autoComplete="off" />
          </Field>
          <button type="submit" className="primary">
            {editingMethod !== null ? "Salva modifiche" : "Aggiungi"}
          </button>
          {editingMethod !== null && (
            <button type="button" className="ghost cancel-edit" onClick={resetMethodForm}>
              Annulla
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
