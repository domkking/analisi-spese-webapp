import { createDefaultLedger, type Ledger } from "../core/index.ts";
import type { LedgerStorage, LoadResult } from "./types.ts";

/** Ripiego quando il browser non permette di salvare (es. alcune modalità privata): i dati vivono solo nella pagina. */
export class MemoryStorage implements LedgerStorage {
  readonly mode = "memory" as const;

  load(): Promise<LoadResult> {
    return Promise.resolve({
      ledger: createDefaultLedger(),
      warnings: [
        "Questo browser non permette di salvare i dati sul dispositivo: chiudendo la pagina andranno persi. Usa «Esporta backup» nella scheda Dati.",
      ],
    });
  }

  save(_ledger: Ledger): Promise<void> {
    return Promise.resolve();
  }

  clear(): Promise<void> {
    return Promise.resolve();
  }
}
