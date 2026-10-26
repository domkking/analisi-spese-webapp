# Sicurezza

## Segnalare una vulnerabilità
Non aprire una issue pubblica. Usa **Security → Report a vulnerability** (segnalazione privata di GitHub) nella pagina del repository.

## Modello di sicurezza
- Nessun backend: nessun dato utente lascia il dispositivo, nessun segreto nel repository.
- Content-Security-Policy restrittiva (solo risorse dello stesso sito, nessuno script/stile inline, nessuna rete esterna).
- Testo dell'utente mostrato sempre come testo (React); `dangerouslySetInnerHTML` non è usato.
- File importati trattati come non fidati: limite di dimensione, controllo di tipo/lunghezza/intervallo su ogni campo, chiavi controllate (nessun prototype pollution).
- Importi come interi in centesimi (niente errori di arrotondamento).
- Dipendenze minime (React) e aggiornamenti automatici con Dependabot; `package-lock.json` versionato.
