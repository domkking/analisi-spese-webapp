/**
 * Finestre di conferma in linea con la grafica dell'app (al posto di window.confirm).
 * Si basano sull'elemento nativo <dialog>: focus intrappolato nella finestra, sfondo inattivo,
 * tasto Esc, annuncio ai lettori di schermo. Uso:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Eliminare?", message: "…", tone: "danger" }))) return;
 */
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  /** Se presente, per abilitare la conferma l'utente deve digitare questo testo (azioni irreversibili). */
  requireText?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error("ConfirmProvider mancante");
  return value;
}

interface Pending {
  id: number;
  options: ConfirmOptions;
  resolve(result: boolean): void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const counter = useRef(0);

  const settle = useCallback((result: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    pendingRef.current = null;
    setPending(null);
    current.resolve(result);
  }, []);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        pendingRef.current?.resolve(false); // una nuova richiesta annulla quella ancora aperta
        const next: Pending = { id: ++counter.current, options, resolve };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog key={pending.id} options={pending.options} onResult={settle} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ options, onResult }: { options: ConfirmOptions; onResult(result: boolean): void }) {
  const { title, message, confirmLabel = "Conferma", cancelLabel = "Annulla", tone = "primary", requireText } = options;
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const messageId = useId();
  const unlocked = requireText === undefined || typed.trim().toUpperCase() === requireText.toUpperCase();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    // Si parte dal pulsante «Annulla» (o dal campo di conferma): mai da quello distruttivo.
    (inputRef.current ?? cancelRef.current)?.focus();
    return () => {
      dialog.close();
      opener?.focus(); // il focus torna al pulsante che ha aperto la finestra
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault(); // tasto Esc
        onResult(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onResult(false); // clic sullo sfondo
      }}
    >
      <div className="modal-body">
        <div className={`modal-icon ${tone}`} aria-hidden="true">
          {tone === "danger" ? "!" : "?"}
        </div>
        <h2 id={titleId}>{title}</h2>
        <div id={messageId} className="modal-message">
          {typeof message === "string" ? message.replaceAll(" €", "\u00a0€") : message /* importi mai spezzati a capo */}
        </div>
        {requireText !== undefined && (
          <label className="field modal-field">
            <span className="field-label">
              Per confermare scrivi <strong>{requireText}</strong>
            </span>
            <input
              ref={inputRef}
              value={typed}
              autoComplete="off"
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && unlocked) onResult(true);
              }}
            />
          </label>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" ref={cancelRef} className="ghost modal-btn" onClick={() => onResult(false)}>
          {cancelLabel}
        </button>
        <button type="button" className={`modal-btn ${tone === "danger" ? "danger-solid" : "primary"}`} disabled={!unlocked} onClick={() => onResult(true)}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
