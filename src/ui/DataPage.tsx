import { useEffect, useState, type ChangeEvent } from "react";

import { AppError, LIMITS, parseBackup, plural, serializeLedger } from "../core/index.ts";
import { useApp } from "../state/AppContext.tsx";
import { useConfirm } from "./components/Confirm.tsx";

export function DataPage() {
  const { ledger, today, newId, replaceAll, wipeAll, notify, storageMode } = useApp();
  const confirm = useConfirm();
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  function exportBackup(): void {
    const blob = new Blob([serializeLedger(ledger)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analisi-spese-${today}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    notify("info", "Backup esportato. Conservalo in un posto sicuro.");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = ""; // permette di riselezionare lo stesso file
    if (!file) return;
    if (file.size > LIMITS.maxBackupChars) {
      notify("error", "Il file è troppo grande.");
      return;
    }
    try {
      const imported = parseBackup(await file.text(), newId);
      const ok = await confirm({
        title: "Importare il backup?",
        message: `Il file contiene ${plural(imported.movements.length, "movimento", "movimenti")}, ${plural(imported.funds.length, "fondo", "fondi")} e ${plural(imported.categories.length, "categoria", "categorie")}. I dati attuali verranno sostituiti (ne resta un backup automatico).`,
        confirmLabel: "Importa e sostituisci",
      });
      if (ok && (await replaceAll(imported))) notify("info", "Backup importato.");
    } catch (error) {
      if (error instanceof AppError) notify("error", error.message);
      else throw error;
    }
  }

  async function wipe(): Promise<void> {
    const ok = await confirm({
      title: "Cancellare tutti i dati?",
      message:
        "Verranno eliminati movimenti, fondi, categorie, impostazioni e backup automatici da questo dispositivo. L'operazione non si può annullare: se vuoi conservare i dati, esporta prima un backup.",
      confirmLabel: "Cancella tutto",
      tone: "danger",
      requireText: "CANCELLA",
    });
    if (!ok) return;
    if (await wipeAll()) notify("info", "Tutti i dati sono stati cancellati.");
  }

  return (
    <section aria-label="Dati e privacy" className="stack">
      <div className="card">
        <h2 className="section-title">Privacy</h2>
        <p>
          I tuoi dati restano <strong>solo su questo dispositivo</strong>, nella memoria del browser. Non vengono inviati a nessun server, non ci sono account,
          cookie o strumenti di tracciamento.
        </p>
        <p className="muted">
          {storageMode === "memory"
            ? "Questo browser non consente di salvare i dati: esporta un backup prima di chiudere la pagina."
            : persisted
              ? "Archiviazione persistente attiva: il browser non cancellerà i dati per liberare spazio."
              : "Il browser potrebbe cancellare i dati se lo spazio è scarso, o se pulisci i dati di navigazione: fai backup regolari."}
        </p>
      </div>

      <div className="card">
        <h2 className="section-title">Backup</h2>
        <p className="muted">
          Il file è compatibile con l'app desktop: puoi spostare i dati dall'una all'altra. Cambiando browser o dispositivo, esporta qui e importa lì.
        </p>
        <div className="actions">
          <button type="button" className="primary" onClick={exportBackup}>
            Esporta backup
          </button>
          <label className="button ghost">
            Importa backup
            <input type="file" accept="application/json,.json" hidden onChange={(event) => void importBackup(event)} />
          </label>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Zona pericolosa</h2>
        <p className="muted">Cancella movimenti, categorie, impostazioni e backup automatici da questo dispositivo.</p>
        <button type="button" className="danger" onClick={() => void wipe()}>
          Cancella tutti i miei dati
        </button>
      </div>
    </section>
  );
}
