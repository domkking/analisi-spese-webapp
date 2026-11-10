import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  addFund,
  deleteFunds,
  formatDateIt,
  formatEur,
  formatInput,
  fundsForKey,
  parseAmount,
  periodBounds,
  plural,
  updateFund,
  type Fund,
} from "../core/index.ts";
import { useApp } from "../state/AppContext.tsx";
import { useConfirm } from "./components/Confirm.tsx";
import { Field } from "./components/Field.tsx";
import { RecordList } from "./components/RecordList.tsx";

interface Props {
  periodKey: string;
  onPeriodChange(key: string): void;
}

/** Fondi aggiunti nel periodo (versamenti, rimborsi, entrate extra): aumentano il saldo e fanno ricalcolare tutto. */
export function Funds({ periodKey, onPeriodChange }: Props) {
  const { ledger, today, commit, notify, newId } = useApp();
  const confirm = useConfirm();
  const rows = useMemo(() => fundsForKey(ledger, periodKey), [ledger, periodKey]);
  const total = rows.reduce((sum, f) => sum + f.amountCents, 0);

  const bounds = periodBounds(periodKey, ledger.payDay);
  const defaultDate = today >= bounds.start && today <= bounds.end ? today : bounds.start;
  const [date, setDate] = useState(defaultDate);
  useEffect(() => setDate(defaultDate), [defaultDate]);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(""); // «» = nessuna categoria
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const descriptionRef = useRef<HTMLInputElement | null>(null);

  const editing = rows.find((f) => f.id === editingId) ?? null;
  useEffect(() => {
    if (editingId !== null && editing === null) setEditingId(null);
  }, [editingId, editing]);

  // se la categoria scelta non esiste più si torna a «Nessuna categoria»
  const categoryValue = category === "" || ledger.categories.some((c) => c.name === category) ? category : "";
  const selectedIds = rows.filter((f) => selected.has(f.id)).map((f) => f.id);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function startEdit(f: Fund): void {
    setEditingId(f.id);
    setDate(f.date);
    setDescription(f.description);
    setCategory(f.category ?? "");
    setAmount(formatInput(f.amountCents));
    formRef.current?.scrollIntoView({ block: "nearest" });
    descriptionRef.current?.focus();
  }

  function resetForm(): void {
    setEditingId(null);
    setDescription("");
    setCategory("");
    setAmount("");
    setDate(defaultDate);
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const wasEditing = editing;
    const outcome = await commit((l) => {
      const input = { date, description, amountCents: parseAmount(amount), category: categoryValue === "" ? null : categoryValue };
      return wasEditing ? updateFund(l, wasEditing.id, input) : addFund(l, input, { newId, today });
    });
    if (!outcome) return;
    resetForm();
    if (outcome.periodKey !== periodKey) onPeriodChange(outcome.periodKey);
    notify(
      "info",
      wasEditing
        ? "Versamento aggiornato. Saldo, minimo e previsioni sono stati ricalcolati."
        : `Fondi aggiunti: +${formatEur(outcome.fund.amountCents)}. Saldo, minimo e previsioni sono stati ricalcolati.`,
    );
  }

  async function removeSelected(): Promise<void> {
    if (selectedIds.length === 0) return;
    const chosen = rows.filter((f) => selected.has(f.id));
    const sum = chosen.reduce((acc, f) => acc + f.amountCents, 0);
    const ok = await confirm({
      title: chosen.length === 1 ? "Eliminare questo versamento?" : `Eliminare ${chosen.length} versamenti?`,
      message: `Verranno tolti ${formatEur(sum)} dal saldo del periodo: saldo, minimo e previsioni saranno ricalcolati.`,
      confirmLabel: "Elimina",
      tone: "danger",
    });
    if (!ok) return;
    await commit((l) => deleteFunds(l, selectedIds));
    setSelected(new Set());
  }

  function toggle(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <section aria-label="Fondi">
      <form ref={formRef} className={`card form-grid${editing ? " editing-card" : ""}`} onSubmit={(event) => void submit(event)}>
        <h2 className="section-title wide">{editing ? "Modifica versamento" : "Aggiungi fondi"}</h2>
        <Field label="Data">
          <input type="date" required min="2000-01-01" max="2100-12-31" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Descrizione" className="grow">
          <input ref={descriptionRef} maxLength={120} placeholder="Es. Rimborso, bonus, versamento" value={description} onChange={(e) => setDescription(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Categoria">
          <select value={categoryValue} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Nessuna categoria</option>
            {ledger.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Importo (€)" className="narrow">
          <input inputMode="decimal" placeholder="0,00" required value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
        </Field>
        <div className="form-actions">
          <button type="submit" className="primary">
            {editing ? "Salva modifiche" : "+ Aggiungi fondi"}
          </button>
          {editing && (
            <button type="button" className="ghost cancel-edit" onClick={resetForm}>
              Annulla modifica
            </button>
          )}
        </div>
        <p className="muted params-note">
          I fondi aumentano il saldo del periodo in cui cadono. Con il minimo <strong>automatico</strong> il minimo sale dello stesso importo (il budget non cambia):
          per spendere i fondi aumenta i budget delle categorie. Con il minimo <strong>manuale</strong> aumentano invece il budget spendibile.
          <br />
          <strong>Categoria</strong>: se scegli una categoria (es. un rimborso), l'importo viene scalato dalle spese di quella categoria nel riepilogo «Dove stai spendendo» e nel
          grafico. Con «Nessuna categoria» il fondo è un normale versamento e non cambia nessun riepilogo per categoria.
        </p>
      </form>

      <div className="card">
        <div className="table-head">
          <h2 className="section-title">Fondi del periodo</h2>
          <span className="muted">{plural(rows.length, "versamento", "versamenti")}</span>
          <span className="pill">Totale +{formatEur(total)}</span>
        </div>
        {rows.length === 0 ? (
          <p className="muted">Nessun fondo aggiunto in questo periodo.</p>
        ) : (
          <RecordList
            columns={[{ title: "Data" }, { title: "Descrizione" }, { title: "Categoria" }, { title: "Importo", numeric: true }]}
            rows={rows.map((f) => ({
              id: f.id,
              cells: [formatDateIt(f.date), f.description, f.category ?? "—", `+${formatEur(f.amountCents)}`],
              title: f.description || "Versamento",
              meta: f.category ? `${formatDateIt(f.date)} · ${f.category}` : formatDateIt(f.date),
              amount: `+${formatEur(f.amountCents)}`,
              selectLabel: `Seleziona ${f.description || "versamento"}`,
              editLabel: `Modifica ${f.description || "versamento"}`,
            }))}
            selected={selected}
            editingId={editing?.id ?? null}
            onToggle={toggle}
            onToggleAll={() => setSelected(allSelected ? new Set() : new Set(rows.map((f) => f.id)))}
            onEdit={(id) => {
              const found = rows.find((f) => f.id === id);
              if (found) startEdit(found);
            }}
          />
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
