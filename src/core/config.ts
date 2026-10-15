/** Costanti centrali: limiti di sicurezza e valori predefiniti. */
export const SCHEMA_VERSION = 2;

export const LIMITS = {
  maxBackupChars: 20_000_000,
  maxMovements: 100_000,
  maxCategories: 200,
  maxMethods: 50,
  maxNameLength: 40,
  maxDescriptionLength: 120,
  /**
   * 100 milioni di euro, in centesimi. Con al massimo 100.000 movimenti la somma
   * resta sotto Number.MAX_SAFE_INTEGER: i calcoli in interi non perdono precisione.
   */
  maxAmountCents: 10_000_000_000,
  minYear: 2000,
  maxYear: 2100,
} as const;

export const DEFAULTS = {
  payDay: 15,
  startBalanceCents: 1_000_000,
  minBalanceCents: 950_000,
  categories: [
    { name: "Alimentari", budgetCents: 20_000 },
    { name: "Trasporti", budgetCents: 8_000 },
    { name: "Casa", budgetCents: 10_000 },
    { name: "Svago", budgetCents: 6_000 },
    { name: "Salute", budgetCents: 4_000 },
    { name: "Abbonamenti", budgetCents: 3_000 },
    { name: "Altro", budgetCents: 5_000 },
  ],
  methods: ["Carta di credito", "Bancomat", "Contanti", "Bonifico", "PayPal"],
} as const;
