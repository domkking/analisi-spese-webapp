import { useState } from "react";

export interface SortableItem {
  readonly id: string;
  readonly primary: string;
  readonly secondary?: string;
}

interface Props {
  label: string;
  items: readonly SortableItem[];
  emptyText: string;
  selectedId?: string | null;
  onReorder(ids: string[]): void;
  onSelect?(id: string): void;
  onDelete?(id: string): void;
}

/** Lista riordinabile: trascinamento col mouse + pulsanti ▲▼ (touch e tastiera). */
export function SortableList({ label, items, emptyText, selectedId = null, onReorder, onSelect, onDelete }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const ids = items.map((item) => item.id);

  function moveTo(id: string, target: number): void {
    const from = ids.indexOf(id);
    if (from < 0 || target < 0 || target >= ids.length || from === target) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(target, 0, id);
    onReorder(next);
  }

  if (items.length === 0) return <p className="muted">{emptyText}</p>;

  return (
    <ul className="sortable" aria-label={label}>
      {items.map((item, index) => (
        <li
          key={item.id}
          className={`sortable-row${item.id === selectedId ? " selected" : ""}${item.id === dragId ? " dragging" : ""}`}
          draggable
          onDragStart={() => setDragId(item.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (dragId !== null) moveTo(dragId, index);
            setDragId(null);
          }}
          onDragEnd={() => setDragId(null)}
        >
          <span className="grip" aria-hidden="true">
            ⋮⋮
          </span>
          <button type="button" className="row-main" onClick={() => onSelect?.(item.id)}>
            <span>{item.primary}</span>
            {item.secondary !== undefined && <span className="row-secondary">{item.secondary}</span>}
          </button>
          <button type="button" className="icon-btn" aria-label={`Sposta su ${item.primary}`} disabled={index === 0} onClick={() => moveTo(item.id, index - 1)}>
            ▲
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Sposta giù ${item.primary}`}
            disabled={index === items.length - 1}
            onClick={() => moveTo(item.id, index + 1)}
          >
            ▼
          </button>
          {onDelete && (
            <button type="button" className="icon-btn danger" aria-label={`Elimina ${item.primary}`} onClick={() => onDelete(item.id)}>
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
