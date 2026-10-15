import { useEffect, useMemo, useState, type FormEvent } from "react";

import { addMovement, deleteMovements, formatDateIt, formatEur, movementsForKey, parseAmount, periodBounds } from "../core/index.ts";
import { useApp } from "../state/AppContext.tsx";
import { Field } from "./components/Field.tsx";

interface Props {
  periodKey: string;
  onPeriodChange(key: string): void;
}

export function Transactions({ periodKey, onPeriodChange }: Props) {
  const { ledger, today, commit, notify, newId } = useApp();
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

  const categoryValue = ledger.categories.some((c) => c.name === category) ? category : (ledger.categories[0]?.name ?? "");
  const methodValue = ledger.methods.includes(method) ? method : (ledger.methods[0] ?? "");
  const selectedIds = rows.filter((m) => selected.has(m.id)).map((m) => m.id);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const outcome = await commit((l) =>
      addMovement(l, { date, description, category: categoryValue, method: methodValue, amountCents: parseAmount(amount) }, { newId, today }),
    );
    if (!outcome) return;
    setDescription("");
    setAmount("");
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
    if (!window.confirm(`Eliminare ${selectedIds.length} movimento/i?`)) return;
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
      <form className="card form-grid" onSubmit={(event) => void submit(event)}>
        <h2 className="section-title wide">Nuovo movimento</h2>
        <Field label="Data">
          <input type="date" required min="2000-01-01" max="2100-12-31" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Descrizione" className="grow">
          <input maxLength={120} placeholder="Es. Spesa Esselunga" value={description} onChange={(e) => setDescription(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Categoria">
          <select value={categoryValue} onChange={(e) => setCategory(e.target.value)}>
            {ledger.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Metodo di pagamento">
          <select value={methodValue} onChange={(e) => setMethod(e.target.value)}>
            {ledger.methods.map((name) => (
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
          + Aggiungi
        </button>
      </form>

      <div className="card">
        <div className="table-head">
          <h2 className="section-title">Movimenti del periodo</h2>
          <span className="muted">{rows.length} movimenti</span>
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
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className={selected.has(m.id) ? "selected" : ""}>
                    <td className="check">
                      <input type="checkbox" aria-label={`Seleziona ${m.description || m.category}`} checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                    </td>
                    <td>{formatDateIt(m.date)}</td>
                    <td>{m.description}</td>
                    <td>{m.category}</td>
                    <td>{m.method}</td>
                    <td className="num">{formatEur(m.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-foot">
          <span className="muted">Seleziona una o più righe per eliminarle</span>
          <button type="button" className="danger" disabled={selectedIds.length === 0} onClick={() => void removeSelected()}>
            Elimina selezionati{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </button>
        </div>
      </div>
    </section>
  );
}
