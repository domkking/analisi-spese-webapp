/**
 * Preferenze dell'interfaccia (es. sezioni aperte/chiuse): solo "1"/"0" in localStorage, nessun dato personale.
 * Se lo storage non è disponibile (modalità privata, blocchi) l'app funziona comunque, senza memoria.
 */
import { useCallback, useState } from "react";

const PREFIX = "analisi-spese.ui.";

export function usePersistentFlag(name: string, initial: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(PREFIX + name);
      return raw === null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(PREFIX + name, next ? "1" : "0");
      } catch {
        /* storage non disponibile: la scelta vale solo per questa sessione */
      }
    },
    [name],
  );
  return [value, update];
}

/** Rimuove tutte le preferenze dell'interfaccia (usata da «Cancella tutti i miei dati»). */
export function clearUiPrefs(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* niente da fare */
  }
}
