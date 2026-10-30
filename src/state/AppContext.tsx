/**
 * Stato globale: tiene il Ledger in memoria e lo salva a ogni modifica.
 * `commit` applica una funzione PURA del core: calcola il nuovo stato, lo salva e solo
 * se il salvataggio riesce lo mostra. Se fallisce, lo stato resta quello precedente.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AppError, createDefaultLedger, todayIso, type Change, type Ledger } from "../core/index.ts";
import { createStorage, type LedgerStorage } from "../storage/index.ts";
import { newId } from "./ids.ts";
import { clearUiPrefs } from "./uiPrefs.ts";

export interface Notice {
  readonly id: number;
  readonly kind: "info" | "warn" | "error";
  readonly text: string;
}

export interface AppApi {
  readonly ledger: Ledger;
  /** Data odierna ISO (si aggiorna da sola a mezzanotte). */
  readonly today: string;
  readonly notices: readonly Notice[];
  readonly storageMode: "indexeddb" | "memory";
  readonly newId: () => string;
  commit<T>(fn: (ledger: Ledger) => Change<T>): Promise<T | undefined>;
  /** Sostituisce tutti i dati (es. importazione di un backup). */
  replaceAll(ledger: Ledger): Promise<boolean>;
  /** Cancella tutti i dati dal dispositivo (anche i backup automatici). */
  wipeAll(): Promise<boolean>;
  notify(kind: Notice["kind"], text: string): void;
  dismiss(id: number): void;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppContext mancante");
  return value;
}

type Boot =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; storage: LedgerStorage; ledger: Ledger; warnings: string[] };

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const storage = await createStorage();
        const result = await storage.load(newId);
        if (!cancelled) setBoot({ status: "ready", storage, ledger: result.ledger, warnings: result.warnings });
      } catch (error) {
        const message = error instanceof AppError ? error.message : "Impossibile avviare l'applicazione.";
        if (!cancelled) setBoot({ status: "error", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (boot.status === "loading") return <p className="boot">Caricamento…</p>;
  if (boot.status === "error") {
    return (
      <div className="boot" role="alert">
        <h1>Analisi Spese</h1>
        <p>{boot.message}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Riprova
        </button>
      </div>
    );
  }
  return (
    <ReadyProvider storage={boot.storage} initialLedger={boot.ledger} initialWarnings={boot.warnings}>
      {children}
    </ReadyProvider>
  );
}

interface ReadyProps {
  storage: LedgerStorage;
  initialLedger: Ledger;
  initialWarnings: string[];
  children: ReactNode;
}

function ReadyProvider({ storage, initialLedger, initialWarnings, children }: ReadyProps) {
  const [ledger, setLedger] = useState(initialLedger);
  const ledgerRef = useRef(initialLedger);
  const [notices, setNotices] = useState<Notice[]>(() =>
    initialWarnings.map((text, index) => ({ id: index + 1, kind: "warn" as const, text })),
  );
  const nextNoticeId = useRef(initialWarnings.length + 1);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const channel = useRef<BroadcastChannel | null>(null);
  const [today, setToday] = useState(() => todayIso(new Date()));

  const notify = useCallback((kind: Notice["kind"], text: string) => {
    setNotices((previous) => [...previous.slice(-3), { id: nextNoticeId.current++, kind, text }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setNotices((previous) => previous.filter((n) => n.id !== id));
  }, []);

  const adopt = useCallback((next: Ledger) => {
    ledgerRef.current = next;
    setLedger(next);
  }, []);

  /** Esegue le modifiche una alla volta, nell'ordine in cui arrivano. */
  const enqueue = useCallback(<T,>(task: () => Promise<T | undefined>): Promise<T | undefined> => {
    const run = async (): Promise<T | undefined> => {
      try {
        return await task();
      } catch (error) {
        if (error instanceof AppError) {
          notify("error", error.message);
          return undefined;
        }
        throw error;
      }
    };
    const result = queue.current.then(run, run);
    queue.current = result.catch(() => undefined);
    return result;
  }, [notify]);

  const commit = useCallback(
    <T,>(fn: (ledger: Ledger) => Change<T>): Promise<T | undefined> =>
      enqueue(async () => {
        const change = fn(ledgerRef.current); // può lanciare ValidationError: nulla viene salvato
        await storage.save(change.ledger); // se fallisce lo stato visibile non cambia
        adopt(change.ledger);
        channel.current?.postMessage("changed");
        return change.value;
      }),
    [adopt, enqueue, storage],
  );

  const replaceAll = useCallback(
    async (next: Ledger): Promise<boolean> =>
      (await enqueue(async () => {
        await storage.save(next);
        adopt(next);
        channel.current?.postMessage("changed");
        return true;
      })) === true,
    [adopt, enqueue, storage],
  );

  const wipeAll = useCallback(
    async (): Promise<boolean> =>
      (await enqueue(async () => {
        await storage.clear();
        clearUiPrefs();
        adopt(createDefaultLedger());
        channel.current?.postMessage("changed");
        return true;
      })) === true,
    [adopt, enqueue, storage],
  );

  // Più schede aperte: quando un'altra scheda salva, questa ricarica i dati.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel("analisi-spese");
    channel.current = bc;
    bc.onmessage = () => {
      void storage
        .load(newId)
        .then((result) => adopt(result.ledger))
        .catch(() => notify("error", "Impossibile aggiornare i dati dall'altra scheda."));
    };
    return () => {
      bc.close();
      channel.current = null;
    };
  }, [adopt, notify, storage]);

  // Chiede al browser di non cancellare i dati in caso di poco spazio (best effort).
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined);
  }, []);

  // «Oggi» si aggiorna da solo se la pagina resta aperta oltre la mezzanotte.
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayIso(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const value = useMemo<AppApi>(
    () => ({ ledger, today, notices, storageMode: storage.mode, newId, commit, replaceAll, wipeAll, notify, dismiss }),
    [ledger, today, notices, storage.mode, commit, replaceAll, wipeAll, notify, dismiss],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
