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
        Inserisci il <em>saldo a inizio periodo</em> (dopo l'accredito dello stipendio) e premi Salva. Il <em>saldo minimo desiderato</em> è calcolato in
        automatico: saldo iniziale − totale dei budget delle categorie. Così il budget spendibile coincide con la somma delle categorie (es. saldo 10.000 € e
        budget totale 560 € → minimo 9.440 €).
      </p>
      <p>
        Puoi scrivere un minimo diverso: vale solo per quel periodo (etichetta «Manuale») e con «Ripristina automatico» torni al calcolo. Per i periodi
        successivi il saldo iniziale viene riportato (saldo iniziale − spese del periodo precedente) e il minimo torna automatico. Quando arriva lo stipendio
        conviene reimpostare il saldo reale.
      </p>

      <h3>2. Registra i movimenti</h3>
      <p>
        Nella scheda Movimenti scegli data (anche passata, dal calendario), descrizione, categoria, metodo e importo. Per eliminare, seleziona le righe e premi
        «Elimina selezionati».
      </p>

      <h3>Correggere un inserimento</h3>
      <p>
        Non serve eliminare e ricreare: nelle schede <em>Movimenti</em> e <em>Fondi</em> premi ✎ sulla riga, correggi i campi nel modulo in alto e
        scegli «Salva modifiche» (o «Annulla modifica»). In <em>Categorie &amp; Budget</em> clicca una riga per cambiare nome e budget della categoria o
        rinominare un metodo di pagamento: il nuovo nome viene aggiornato anche sui movimenti già registrati. Saldi, minimo, avvisi e previsioni si
        ricalcolano da soli.
      </p>

      <h3>3. Aggiungi fondi</h3>
      <p>
        Se durante il periodo arrivano soldi (un rimborso, un bonus, un versamento) registrali nella scheda <em>Fondi</em>: il saldo viene ricalcolato e i fondi
        vengono riportati nei periodi successivi. Con il minimo <em>automatico</em> il minimo sale dello stesso importo e il budget resta uguale alla somma
        delle categorie: per spendere i fondi aumenta i budget delle categorie. Con il minimo <em>manuale</em> i fondi aumentano direttamente il budget
        spendibile.
      </p>

      <h3>4. Categorie e metodi</h3>
      <p>
        In «Categorie & Budget» imposti il budget massimo di ogni categoria e i metodi di pagamento. Riordina trascinando le righe o con ▲▼, oppure usa «Ordina
        A–Z». I movimenti già registrati restano anche se elimini una categoria.
      </p>

      <h3>5. Leggi la Dashboard</h3>
      <ul>
        <li>
          In alto trovi l'essenziale: budget residuo (con quanto puoi spendere al giorno), spese di oggi, saldo attuale e saldo previsto a fine periodo.
        </li>
        <li>
          «Dettagli del periodo», il grafico e i «Parametri del periodo» si aprono con un tocco; l'app ricorda quali sezioni lasci aperte. Per le categorie vedi
          dove stai spendendo di più, e «Mostra tutte le categorie» le elenca tutte.
        </li>
        <li>Saldo attuale = saldo iniziale + fondi − spese registrate.</li>
        <li>Spese di oggi = somma dei movimenti con la data di oggi (compare solo se oggi cade nel periodo che stai guardando).</li>
        <li>Saldo previsto = saldo attuale − (spesa media giornaliera × giorni rimasti).</li>
        <li>Budget giornaliero residuo = budget residuo ÷ giorni rimasti.</li>
        <li>Avvisi: verde = nel budget, giallo = oltre l'80%, rosso = budget superato.</li>
      </ul>

      <h3>6. Dati e backup</h3>
      <p>
        I dati sono salvati solo nel tuo browser. Esporta spesso un backup dalla scheda «Dati»: è l'unico modo per cambiare dispositivo o recuperare i dati se
        il browser li cancella.
      </p>
    </section>
  );
}
