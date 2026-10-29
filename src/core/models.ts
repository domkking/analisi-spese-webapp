/** Modelli dati (immutabili). Gli importi sono sempre in centesimi interi. */

export interface Movement {
  readonly id: string;
  /** Data ISO «AAAA-MM-GG». */
  readonly date: string;
  readonly description: string;
  readonly category: string;
  readonly method: string;
  readonly amountCents: number;
}

/** Fondi aggiunti (versamento, rimborso, entrata extra): aumentano il saldo del periodo in cui cadono. */
export interface Fund {
  readonly id: string;
  /** Data ISO «AAAA-MM-GG». */
  readonly date: string;
  readonly description: string;
  readonly amountCents: number;
}

export interface CategoryBudget {
  readonly name: string;
  readonly budgetCents: number;
}

/** Valori impostati a mano per un periodo; undefined = calcolato in automatico. */
export interface PeriodParams {
  readonly startBalanceCents?: number | undefined;
  readonly minBalanceCents?: number | undefined;
}

/** Tutti i dati dell'utente. */
export interface Ledger {
  readonly payDay: number;
  readonly categories: readonly CategoryBudget[];
  readonly methods: readonly string[];
  /** Chiave periodo «AAAA-MM» -> parametri impostati a mano. */
  readonly overrides: Readonly<Record<string, PeriodParams>>;
  readonly movements: readonly Movement[];
  readonly funds: readonly Fund[];
}

/** Risultato di una modifica pura: nuovo stato + valore di ritorno. */
export interface Change<T> {
  readonly ledger: Ledger;
  readonly value: T;
}

export interface AddMovementInput {
  readonly date: string;
  readonly description: string;
  readonly category: string;
  readonly method: string;
  readonly amountCents: number;
}

export interface AddFundInput {
  readonly date: string;
  readonly description: string;
  readonly amountCents: number;
}

export interface AddFundOutcome {
  readonly fund: Fund;
  readonly periodKey: string;
}

export interface CategoryAlert {
  readonly category: string;
  readonly spentCents: number;
  readonly budgetCents: number;
}

export interface AddOutcome {
  readonly movement: Movement;
  readonly periodKey: string;
  /** Di quanto si supera il budget del periodo (solo se superato proprio con questa spesa). */
  readonly periodOverrunCents: number | null;
  /** Presente solo se la categoria è stata superata proprio con questa spesa. */
  readonly categoryAlert: CategoryAlert | null;
}

export interface PeriodMetrics {
  readonly key: string;
  readonly startDate: string;
  readonly endDate: string;
  /** Saldo a inizio periodo (senza i fondi aggiunti). */
  readonly startBalanceCents: number;
  /** Totale dei fondi aggiunti nel periodo. */
  readonly fundsCents: number;
  readonly fundCount: number;
  /** Saldo di partenza effettivo: inizio periodo + fondi. Su questo si calcolano minimo, budget e saldo attuale. */
  readonly openingBalanceCents: number;
  readonly minBalanceCents: number;
  /** true se il minimo è calcolato (saldo iniziale − totale budget), false se impostato a mano. */
  readonly minBalanceIsAuto: boolean;
  /** Valore automatico del minimo (anche quando è in uso quello manuale). */
  readonly autoMinBalanceCents: number;
  readonly budgetCents: number;
  readonly spentCents: number;
  readonly remainingBudgetCents: number;
  /** Percentuale usata, in decimi di punto (305 = 30,5 %). */
  readonly percentTenths: number;
  readonly currentBalanceCents: number;
  readonly dailyAverageCents: number;
  readonly daysElapsed: number;
  readonly daysRemaining: number;
  readonly forecastBalanceCents: number;
  /** null quando il periodo è concluso. */
  readonly dailyBudgetLeftCents: number | null;
  readonly topMovement: Movement | null;
  readonly movementCount: number;
  /** true se «oggi» cade nel periodo visualizzato (altrimenti le spese di oggi non si applicano). */
  readonly todayInPeriod: boolean;
  /** Spese con data odierna (solo uscite: i fondi non contano). */
  readonly todaySpentCents: number;
  readonly todayMovementCount: number;
  readonly overBudget: boolean;
}

/** Dipendenze iniettabili: rendono la logica deterministica e testabile. */
export interface Deps {
  readonly newId: () => string;
  /** Data odierna ISO. */
  readonly today: string;
}
