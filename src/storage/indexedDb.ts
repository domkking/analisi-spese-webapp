/**
 * Persistenza su IndexedDB. I dati sono salvati come testo JSON e riletti come NON fidati
 * (stessa validazione di un backup importato). Ogni salvataggio è UNA transazione che
 * copia la versione precedente in «ledger.bak» e scrive la nuova: atomica.
 */
import { createDefaultLedger, parseBackup, serializeLedger, StorageError, ValidationError, type Ledger } from "../core/index.ts";
import type { LedgerStorage, LoadResult } from "./types.ts";

const DB_NAME = "analisi-spese";
const STORE = "kv";
const KEY = "ledger";
const BACKUP_KEY = "ledger.bak";

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Errore IndexedDB"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Errore IndexedDB"));
    tx.onabort = () => reject(tx.error ?? new Error("Transazione annullata"));
  });
}

export class IndexedDbStorage implements LedgerStorage {
  readonly mode = "indexeddb" as const;
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static open(): Promise<IndexedDbStorage> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(new IndexedDbStorage(request.result));
      request.onerror = () => reject(request.error ?? new Error("Impossibile aprire IndexedDB"));
      request.onblocked = () => reject(new Error("IndexedDB bloccato"));
    });
  }

  private store(mode: IDBTransactionMode): { tx: IDBTransaction; store: IDBObjectStore } {
    const tx = this.db.transaction(STORE, mode);
    return { tx, store: tx.objectStore(STORE) };
  }

  private async read(key: string): Promise<unknown> {
    try {
      return await promisify(this.store("readonly").store.get(key));
    } catch {
      throw new StorageError("Impossibile leggere i dati salvati nel browser.");
    }
  }

  async load(newId: () => string): Promise<LoadResult> {
    const raw = await this.read(KEY);
    if (raw === undefined) return { ledger: createDefaultLedger(), warnings: [] };
    try {
      return { ledger: parseBackup(String(raw), newId), warnings: [] };
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      return this.recover(raw, newId);
    }
  }

  /** Dati illeggibili: si conserva una copia, poi si prova l'ultimo backup. Mai sovrascritti in silenzio. */
  private async recover(raw: unknown, newId: () => string): Promise<LoadResult> {
    const quarantineKey = `ledger.corrupt-${Date.now()}`;
    const warnings: string[] = [];
    try {
      const { tx, store } = this.store("readwrite");
      store.put(raw, quarantineKey);
      store.delete(KEY);
      await transactionDone(tx);
      warnings.push("I dati salvati non erano leggibili: ne è stata conservata una copia di sicurezza.");
    } catch {
      warnings.push("I dati salvati non erano leggibili.");
    }
    const backup = await this.read(BACKUP_KEY);
    if (backup !== undefined) {
      try {
        const ledger = parseBackup(String(backup), newId);
        warnings.push("Sono stati ripristinati i dati dell'ultimo backup automatico.");
        return { ledger, warnings };
      } catch {
        /* backup non valido: si riparte da zero */
      }
    }
    warnings.push("Non è stato possibile recuperare i dati: si riparte da zero. Se hai un file di backup, importalo.");
    return { ledger: createDefaultLedger(), warnings };
  }

  async save(ledger: Ledger): Promise<void> {
    const text = serializeLedger(ledger);
    try {
      const { tx, store } = this.store("readwrite");
      const current = store.get(KEY);
      current.onsuccess = () => {
        if (current.result !== undefined) store.put(current.result, BACKUP_KEY);
        store.put(text, KEY);
      };
      await transactionDone(tx);
    } catch (error) {
      const quota = error instanceof DOMException && error.name === "QuotaExceededError";
      throw new StorageError(
        quota
          ? "Spazio del browser esaurito: esporta un backup e libera spazio."
          : "Salvataggio non riuscito: i dati non sono stati modificati.",
      );
    }
  }

  async clear(): Promise<void> {
    try {
      const { tx, store } = this.store("readwrite");
      store.clear();
      await transactionDone(tx);
    } catch {
      throw new StorageError("Impossibile cancellare i dati.");
    }
  }
}
