import type { Ledger } from "../core/index.ts";

export interface LoadResult {
  readonly ledger: Ledger;
  /** Messaggi da mostrare all'utente (file corrotto, backup ripristinato, ...). */
  readonly warnings: string[];
}

/** Contratto di persistenza: oggi IndexedDB nel browser; domani, se serve, un'API remota. */
export interface LedgerStorage {
  readonly mode: "indexeddb" | "memory";
  load(newId: () => string): Promise<LoadResult>;
  save(ledger: Ledger): Promise<void>;
  /** Cancella TUTTO (dati, backup, copie di quarantena). */
  clear(): Promise<void>;
}
