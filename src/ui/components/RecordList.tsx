import { useMediaQuery } from "../useMediaQuery.ts";

export interface RecordColumn {
  title: string;
  numeric?: boolean;
}

export interface RecordRow {
  id: string;
  /** Una cella per colonna (vista tabella, schermi larghi). */
  cells: readonly string[];
  /** Vista a schede (cellulare): titolo, riga secondaria e importo. */
  title: string;
  meta: string;
  amount: string;
  selectLabel: string;
  editLabel: string;
}

interface Props {
  columns: readonly RecordColumn[];
  rows: readonly RecordRow[];
  selected: ReadonlySet<string>;
  editingId: string | null;
  onToggle(id: string): void;
  onToggleAll(): void;
  onEdit(id: string): void;
}

/** Elenco di movimenti/fondi: tabella su schermi larghi, schede compatte su cellulare (niente scorrimento orizzontale). */
export function RecordList({ columns, rows, selected, editingId, onToggle, onToggleAll, onEdit }: Props) {
  const compact = useMediaQuery("(max-width: 640px)");
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  if (compact) {
    return (
      <div className="record-list">
        <label className="select-all">
          <input type="checkbox" aria-label="Seleziona tutti" checked={allSelected} onChange={onToggleAll} />
          <span>Seleziona tutti</span>
        </label>
        <ul>
          {rows.map((row) => (
            <li key={row.id} className={`record-card${selected.has(row.id) ? " selected" : ""}${editingId === row.id ? " editing" : ""}`}>
              <input type="checkbox" aria-label={row.selectLabel} checked={selected.has(row.id)} onChange={() => onToggle(row.id)} />
              <div className="record-main">
                <div className="record-title">{row.title}</div>
                <div className="record-meta">{row.meta}</div>
              </div>
              <div className="record-side">
                <span className="record-amount">{row.amount}</span>
                <button type="button" className="icon-btn" aria-label={row.editLabel} title="Modifica" onClick={() => onEdit(row.id)}>
                  ✎
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="check">
              <input type="checkbox" aria-label="Seleziona tutti" checked={allSelected} onChange={onToggleAll} />
            </th>
            {columns.map((column) => (
              <th key={column.title} className={column.numeric ? "num" : undefined}>
                {column.title}
              </th>
            ))}
            <th className="check">
              <span className="visually-hidden">Azioni</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={`${selected.has(row.id) ? "selected" : ""}${editingId === row.id ? " editing" : ""}`.trim()}>
              <td className="check">
                <input type="checkbox" aria-label={row.selectLabel} checked={selected.has(row.id)} onChange={() => onToggle(row.id)} />
              </td>
              {row.cells.map((cell, index) => (
                <td key={index} className={columns[index]?.numeric ? "num" : undefined}>
                  {cell}
                </td>
              ))}
              <td className="check">
                <button type="button" className="icon-btn" aria-label={row.editLabel} title="Modifica" onClick={() => onEdit(row.id)}>
                  ✎
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
