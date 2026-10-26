/** Id casuale di 32 caratteri esadecimali (funziona anche fuori da contesti HTTPS). */
export function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}
