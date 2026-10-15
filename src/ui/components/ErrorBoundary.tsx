import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  failed: boolean;
}

/** Evita la pagina bianca in caso di errore imprevisto di rendering. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Errore di rendering", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="boot" role="alert">
        <h1>Qualcosa è andato storto</h1>
        <p>I tuoi dati salvati non sono stati toccati. Ricarica la pagina per riprovare.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Ricarica
        </button>
      </div>
    );
  }
}
