export function Help() {
  return (
    <section aria-label="Istruzioni" className="card prose">
      <h2 className="section-title">Come funziona</h2>

      <h3>1. Imposta il periodo</h3>
      <p>
        Il «mese» non coincide con quello di calendario: parte dal giorno dello stipendio (di default il 15) e finisce il giorno prima del successivo (es. dal
        15/01 al 14/02). Puoi cambiare il giorno nella Dashboard.
      </p>
      <p>
        Inserisci il <em>saldo a inizio periodo</em> (dopo l'accredito dello stipendio) e il <em>saldo minimo desiderato</em>, poi premi Salva. Il budget
        spendibile è la differenza: 10.000 € − 9.500 € = 500 €.
      </p>
      <p>
        Per i periodi successivi, se non imposti nulla, il saldo iniziale viene calcolato (saldo iniziale − spese del periodo precedente) e il minimo viene
        ripreso. Quando arriva lo stipendio conviene reimpostare il saldo reale.
      </p>

      <h3>2. Registra i movimenti</h3>
      <p>
        Nella scheda Movimenti scegli data (anche passata, dal calendario), descrizione, categoria, metodo e importo. Per eliminare, seleziona le righe e premi
        «Elimina selezionati».
      </p>

      <h3>3. Categorie e metodi</h3>
      <p>
        In «Categorie & Budget» imposti il budget massimo di ogni categoria e i metodi di pagamento. Riordina trascinando le righe o con ▲▼, oppure usa «Ordina
        A–Z». I movimenti già registrati restano anche se elimini una categoria.
      </p>

      <h3>4. Leggi la Dashboard</h3>
      <ul>
        <li>Saldo attuale = saldo iniziale − spese registrate.</li>
        <li>Saldo previsto = saldo attuale − (spesa media giornaliera × giorni rimasti).</li>
        <li>Budget giornaliero residuo = budget residuo ÷ giorni rimasti.</li>
        <li>Avvisi: verde = nel budget, giallo = oltre l'80%, rosso = budget superato.</li>
      </ul>

      <h3>5. Dati e backup</h3>
      <p>
        I dati sono salvati solo nel tuo browser. Esporta spesso un backup dalla scheda «Dati»: è l'unico modo per cambiare dispositivo o recuperare i dati se
        il browser li cancella.
      </p>
    </section>
  );
}
