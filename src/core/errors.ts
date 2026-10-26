/** Errori previsti: il messaggio è pensato per essere mostrato all'utente. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

/** Dato non valido (input utente o contenuto di un file). */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Problema di lettura/scrittura nel browser. */
export class StorageError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}
