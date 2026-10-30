import { useId, type ReactNode } from "react";

interface Props {
  /** Usato come id del DOM («section-<id>») per poter scorrere fino alla sezione. */
  id: string;
  title: string;
  /** Riga di riepilogo sotto il titolo (utile a sezione chiusa). */
  summary?: ReactNode;
  open: boolean;
  onToggle(open: boolean): void;
  children: ReactNode;
}

/** Sezione comprimibile accessibile: il contenuto resta nel DOM (stato dei moduli conservato) ma nascosto. */
export function Collapsible({ id, title, summary, open, onToggle, children }: Props) {
  const panelId = useId();
  return (
    <section id={`section-${id}`} className="card collapsible">
      <h2 className="collapsible-title">
        <button type="button" className="collapsible-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => onToggle(!open)}>
          <span>{title}</span>
          <span className="chevron" aria-hidden="true">
            {open ? "▲" : "▼"}
          </span>
          {summary !== undefined && <span className="collapsible-summary">{summary}</span>}
        </button>
      </h2>
      <div id={panelId} className="collapsible-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
