# Analisi Spese (web)

Web app per controllare le spese per **periodo di stipendio** (es. dal 15 al 14): budget spendibile, categorie, **fondi aggiunti**, indicatori e grafico.
**I dati restano nel browser dell'utente** (nessun server, nessun account). Installabile come app e funzionante offline.

Stack: React 19 + TypeScript (rigoroso) + Vite. Nessun'altra dipendenza a runtime.

## Stato delle verifiche (leggi prima di pubblicare)
Questo progetto è stato scritto e provato in un ambiente **senza accesso a internet**, quindi `npm install` e `vite build` **non sono stati eseguiti**. Verificato:
- 61 test della logica (`npm test`) ✔
- Controllo dei tipi (TypeScript, tutte le opzioni rigorose) ✔ — con tipi React semplificati
- Test end-to-end in Chromium reale (inserimento, fondi, finestre di conferma, persistenza, backup/import, file corrotti, più schede, drag & drop, CSP attiva senza errori) ✔ — con un bundle esbuild equivalente

**Primo avvio, in quest'ordine:**
```bash
npm install            # crea package-lock.json: COMMITTALO (serve a `npm ci` e alla CI)
npm run verify         # tipi + test + build
npm run dev            # sviluppo su http://localhost:5173
```
Se `npm run check` segnala errori (possibile, per i tipi React reali), sono di norma piccoli e localizzati.

## Comandi
| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run check` | TypeScript su tutto il progetto + su `src/core` (che non deve dipendere da DOM/React) |
| `npm test` | test della logica (runner integrato di Node ≥ 22.18, nessuna libreria di test) |
| `npm run build` | build di produzione in `dist/` (con CSP e service worker) |
| `npm run preview` | prova la build in locale |
| `npm run verify` | check + test + build |

## Architettura
```
src/
  core/      LOGICA pura in TypeScript: nessun React, nessun DOM, nessuna rete
    money · validation · periods · metrics · ledger · serialization · format · config · errors · models
  storage/   persistenza dietro l'interfaccia LedgerStorage (oggi IndexedDB; ripiego in memoria)
  state/     AppContext: tiene il Ledger, salva a ogni modifica con rollback se fallisce
  ui/        componenti React (Dashboard, Movimenti, Categorie, Dati, Istruzioni) + components/
tests/       test della logica
scripts/     modello del service worker (completato in fase di build)
```
Regole che tengono il codice pulito:
1. `core/` non importa mai da `ui/`, `state/` o `storage/` (e `tsconfig.core.json` impedisce di usare il DOM).
2. Le operazioni sui dati sono **funzioni pure**: `(ledger, input) → { ledger nuovo, valore }`. Nessuna modifica in place.
3. `commit()` calcola il nuovo stato, lo **salva e solo dopo lo mostra**; se il salvataggio fallisce, l'utente vede ancora lo stato precedente.
4. Importi sempre in **centesimi interi**; divisioni con arrotondamento esatto via BigInt (stessi risultati dell'app desktop).
5. Storage sostituibile: per aggiungere account/sincronizzazione basterà un nuovo adattatore di `LedgerStorage`, senza toccare logica e interfaccia.

## Sicurezza
- **CSP** restrittiva inserita in build (`vite.config.ts`): solo risorse dello stesso sito, nessuno script/stile inline, nessuna rete esterna, nessun `object`/`base`/`form-action`.
- Testi dell'utente sempre mostrati come testo; `dangerouslySetInnerHTML` non usato.
- File importati = dati non fidati: limite di dimensione, validazione di ogni campo, solo proprietà proprie, chiavi `AAAA-MM`, `__proto__` neutralizzato (con test).
- Salvataggio atomico (una transazione IndexedDB) con backup automatico della versione precedente; dati illeggibili conservati in quarantena e ripristino dall'ultimo backup.
- Nessun cookie, nessun tracciamento, nessuno script di terze parti. Vedi `PRIVACY.md` e `SECURITY.md`.
- Dependabot per npm e GitHub Actions. Dopo aver generato `package-lock.json`, valuta di fissare le action per SHA.

## Pubblicare su GitHub Pages
1. Crea il repository (**pubblico**: Pages sui repository privati richiede un piano a pagamento) e carica il progetto, incluso `package-lock.json`.
2. *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
3. A ogni push su `main` il workflow `ci-deploy.yml` esegue check, test e build e pubblica su `https://<utente>.github.io/<repo>/`.
I percorsi sono relativi (`base: "./"`): funziona in qualsiasi sottocartella o dominio personalizzato (aggiungi un file `public/CNAME`).

## Dati e backup
- Formato JSON basato su quello dell'app desktop (chiavi italiane, importi come `"12.50"`), versione 3 con la chiave `fondi`. I file senza `fondi` (app desktop, versioni precedenti) si importano normalmente.
- **Esporta backup** regolarmente: se l'utente pulisce i dati del browser o cambia dispositivo, è l'unico modo per recuperare.
- L'app chiede al browser l'archiviazione persistente (best effort).

## Aggiungere una funzione (esempio: un campo «note»)
`core/models.ts` → `core/serialization.ts` (lettura/scrittura) → `core/ledger.ts` (operazione) → test in `tests/` → componente in `ui/`.

## Limiti noti
- Nessuna sincronizzazione tra dispositivi (solo backup manuale). Più schede dello stesso browser si sincronizzano da sole.
- Il service worker aggiorna l'app alla visita successiva all'uscita di una nuova versione.
- Non esistono ancora test end-to-end automatizzati nel repository (provati manualmente con Playwright): sono il prossimo passo consigliato.
- Il nome in `LICENSE` va sostituito con il tuo.

## Fondi (versione 1.1)
- Si registrano nella scheda **Fondi** (data, descrizione, importo > 0) e valgono per il periodo in cui cadono.
- Saldo di partenza effettivo = saldo a inizio periodo + fondi. Saldo attuale = saldo di partenza − spese.
- Minimo **automatico** = saldo di partenza − totale budget: aggiungendo fondi il minimo sale dello stesso importo e il budget non cambia (per spenderli si alzano i budget delle categorie).
- Minimo **manuale**: budget = saldo di partenza − minimo, quindi i fondi aumentano il budget spendibile.
- I fondi si riportano nei periodi successivi (saldo iniziale riportato = saldo + fondi − spese).

## Finestre di conferma (versione 1.2)
L'app non usa più `alert`/`confirm` del browser: le conferme sono finestre in linea con la grafica (`src/ui/components/Confirm.tsx`), basate sull'elemento nativo `<dialog>`
(focus intrappolato, sfondo inattivo, tasto Esc, clic sullo sfondo = annulla, focus restituito al pulsante di partenza; su schermi stretti diventano un pannello dal basso).
```tsx
const confirm = useConfirm();
const ok = await confirm({ title: "Eliminare?", message: "…", confirmLabel: "Elimina", tone: "danger" });
if (!ok) return;
```
- `tone: "danger"` colora la conferma di rosso e parte con il focus su «Annulla».
- `requireText: "CANCELLA"` richiede di digitare una parola per abilitare l'azione (usato per «Cancella tutti i miei dati»).
- Restano nativi i controlli di sistema: il selettore di data e i menu a tendina.

## Modifica dei dati (versione 1.4)
Niente più «elimina e ricrea»: si corregge direttamente.
- **Movimenti e Fondi**: ✎ sulla riga carica il dato nel modulo in alto («Modifica movimento» / «Modifica versamento»), poi *Salva modifiche* o *Annulla modifica*.
  Si può cambiare tutto, anche la data (il dato passa al periodo corretto e la vista lo segue). Gli avvisi di superamento budget valgono anche per le modifiche.
- **Categorie**: clic sulla riga per cambiare nome e budget. Il nuovo nome viene riportato su tutti i movimenti già registrati (`updateCategory`), la posizione resta la stessa e un nome già esistente viene rifiutato (nessuna fusione involontaria).
- **Metodi di pagamento**: clic sulla riga per rinominarli (`updateMethod`), con lo stesso aggiornamento dei movimenti.
- Se la categoria/il metodo di un movimento sono stati eliminati, il movimento si può comunque correggere mantenendoli (non vengono persi in silenzio).
- Le operazioni sono funzioni pure del core (`updateMovement`, `updateFund`, `updateCategory`, `updateMethod`) con rollback se il salvataggio fallisce, come tutte le altre.

## Home ottimizzata (versione 1.5)
Obiettivo: in una schermata di cellulare solo ciò che serve a decidere. Su un periodo con 8 spese la pagina passa da **2.266 px a 1.207 px (−47%)**; su desktop sta in una schermata.
- **Subito visibili**: *Budget residuo* (con barra, % utilizzata e budget giornaliero), *Spese di oggi*, *Saldo attuale*, *Previsto a fine periodo* e le categorie dove si spende di più (max 5, con spesa > 0; «Mostra tutte» le elenca nell'ordine scelto).
- **A un tocco** (`Collapsible`, accessibili con `aria-expanded`, tastiera e lettori di schermo): *Dettagli del periodo* (minimo, budget spendibile, fondi, spese del periodo, media giornaliera, spesa più alta), *Distribuzione delle spese* e *Parametri del periodo*. Lo stato aperto/chiuso è ricordato (`state/uiPrefs.ts`, solo «1»/«0» in localStorage) e azzerato da «Cancella tutti i miei dati».
- **Mai nascosto ciò che è urgente**: budget superato, avviso all'80%, saldo previsto sotto il minimo e budget che superano il saldo restano in primo piano.
- **Primo avvio**: un invito «Imposta saldo» apre i parametri.
- Il riepilogo per categoria è logica del core (`categoryOverview`, `pickTopCategories`) con test.
