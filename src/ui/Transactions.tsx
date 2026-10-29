import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  addMovement,
  deleteMovements,
  formatDateIt,
  formatEur,
  formatInput,
  movementsForKey,
  parseAmount,
  periodBounds,
  plural,
  updateMovement,
  type Movement,
} from "../core/index.ts";
import { useApp } from "../state/AppContext.tsx";
import { useConfirm } from "./components/Confirm.tsx";
import { Field } from "./components/Field.tsx";

interface Props {
  periodKey: string;
  onPeriodChange(key: string): void;
}

export function Transactions({ periodKey, onPeriodChange }: Props) {
  const { ledger, today, commit, notify, newId } = useApp();
  const confirm = useConfirm();
  const rows = useMemo(() => movementsForKey(ledger, periodKey), [ledger, periodKey]);
  const total = rows.reduce((sum, m) => sum + m.amountCents, 0);

  const bounds = periodBounds(periodKey, ledger.payDay);
  const defaultDate = today >= bounds.start && today <= bounds.end ? today : bounds.start;
  const [date, setDate] = useState(defaultDate);
  useEffect(() => setDate(defaultDate), [defaultDate]);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const descriptionRef = useRef<HTMLInputElement | null>(null);

  // Il movimento in modifica sparisce (eliminato, altro periodo): si torna alla modalità «nuovo».
  const editing = rows.find((m) => m.id === editingId) ?? null;
  useEffect(() => {
    if (editingId !== null && editing === null) setEditingId(null);
  }, [editingId, editing]);

  const categoryNames = ledger.categories.map((c) => c.name);
  // se la categoria/metodo del movimento in modifica è stata eliminata, resta selezionabile per non perderla
  const categoryOptions = editing && !categoryNames.includes(editing.category) ? [...categoryNames, editing.category] : categoryNames;
  const methodOptions = editing && !ledger.methods.includes(editing.method) ? [...ledger.methods, editing.method] : [...ledger.methods];
  const categoryValue = categoryOptions.includes(category) ? category : (categoryNames[0] ?? "");
  const methodValue = methodOptions.includes(method) ? method : (ledger.methods[0] ?? "");
  const selectedIds = rows.filter((m) => selected.has(m.id)).map((m) => m.id);

  function startEdit(m: Movement): void {
    setEditingId(m.id);
    setDate(m.date);
    setDescription(m.description);
    setCategory(m.category);
    setMethod(m.method);
    setAmount(formatInput(m.amountCents));
    formRef.current?.scrollIntoView({ block: "nearest" });
    descriptionRef.current?.focus();
  }

  function resetForm(): void {
    setEditingId(null);
    setDescription("");
    setAmount("");
    setDate(defaultDate);
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const wasEditing = editing;
    const outcome = await commit((l) => {
      const input = { date, description, category: categoryValue, method: methodValue, amountCents: parseAmount(amount) };
      return wasEditing ? updateMovement(l, wasEditing.id, input, { newId, today }) : addMovement(l, input, { newId, today });
    });
    if (!outcome) return;
    resetForm();
    if (wasEditing) notify("info", "Movimento aggiornato. Saldi e indicatori sono stati ricalcolati.");
    if (outcome.periodKey !== periodKey) onPeriodChange(outcome.periodKey);
    if (outcome.periodOverrunCents !== null) {
      notify("warn", `Con questa spesa hai superato il budget del periodo di ${formatEur(outcome.periodOverrunCents)}.`);
    }
    if (outcome.categoryAlert) {
      const a = outcome.categoryAlert;
      notify("warn", `Hai superato il budget della categoria «${a.category}» (${formatEur(a.spentCents)} su ${formatEur(a.budgetCents)}).`);
    }
  }

  async function removeSelected(): Promise<void> {
    if (selectedIds.length === 0) return;
    const chosen = rows.filter((m) => selected.has(m.id));
    const sum = chosen.reduce((acc, m) => acc + m.amountCents, 0);
    const ok = await confirm({
      title: chosen.length === 1 ? "Eliminare questo movimento?" : `Eliminare ${chosen.length} movimenti?`,
      message: `Verranno eliminati ${plural(chosen.length, "movimento", "movimenti")} per un totale di ${formatEur(sum)}. L'operazione non si può annullare.`,
      confirmLabel: "Elimina",
      tone: "danger",
    });
    if (!ok) return;
    await commit((l) => deleteMovements(l, selectedIds));
    setSelected(new Set());
  }

  function toggle(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  return (
    <section aria-label="Movimenti">
      <form ref={formRef} className={`card form-grid${editing ? " editing-card" : ""}`} onSubmit={(event) => void submit(event)}>
        <h2 className="section-title wide">{editing ? "Modifica movimento" : "Nuovo movimento"}</h2>
        <Field label="Data">
          <input type="date" required min="2000-01-01" max="2100-12-31" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Descrizione" className="grow">
          <input ref={descriptionRef} maxLength={120} placeholder="Es. Spesa Esselunga" value={description} onChange={(e) => setDescription(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Categoria">
          <select value={categoryValue} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Metodo di pagamento">
          <select value={methodValue} onChange={(e) => setMethod(e.target.value)}>
            {methodOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Importo (€)" className="narrow">
          <input inputMode="decimal" placeholder="0,00" required value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
        </Field>
        <button type="submit" className="primary">
          {editing ? "Salva modifiche" : "+ Aggiungi"}
        </button>
        {editing && (
          <button type="button" className="ghost cancel-edit" onClick={resetForm}>
            Annulla modifica
          </button>
        )}
      </form>

      <div className="card">
        <div className="table-head">
          <h2 className="section-title">Movimenti del periodo</h2>
          <span className="muted">{plural(rows.length, "movimento", "movimenti")}</span>
          <span className="pill">Totale {formatEur(total)}</span>
        </div>
        {rows.length === 0 ? (
          <p className="muted">Nessun movimento in questo periodo.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="check">
                    <input
                      type="checkbox"
                      aria-label="Seleziona tutti"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((m) => m.id)))}
                    />
                  </th>
                  <th>Data</th>
                  <th>Descrizione</th>
                  <th>Categoria</th>
                  <th>Metodo</th>
                  <th className="num">Importo</th>
                  <th className="check">
                    <span className="visually-hidden">Azioni</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className={`${selected.has(m.id) ? "selected" : ""}${editing?.id === m.id ? " editing" : ""}`.trim()}>
                    <td className="check">
                      <input type="checkbox" aria-label={`Seleziona ${m.description || m.category}`} checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                    </td>
                    <td>{formatDateIt(m.date)}</td>
                    <td>{m.description}</td>
                    <td>{m.category}</td>
                    <td>{m.method}</td>
                    <td className="num">{formatEur(m.amountCents)}</td>
                    <td className="check">
                      <button type="button" className="icon-btn" aria-label={`Modifica ${m.description || m.category}`} title="Modifica" onClick={() => startEdit(m)}>
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-foot">
          <span className="muted">Seleziona una o più righe per eliminarle, oppure ✎ per correggerle</span>
          <button type="button" className="danger" disabled={selectedIds.length === 0} onClick={() => void removeSelected()}>
            Elimina selezionati{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </button>
        </div>
      </div>
    </section>
  );
}
