import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProvider } from "./state/AppContext.tsx";
import { App } from "./ui/App.tsx";
import { ConfirmProvider } from "./ui/components/Confirm.tsx";
import { ErrorBoundary } from "./ui/components/ErrorBoundary.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root non trovato");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ConfirmProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ConfirmProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Service worker: funzionamento offline (solo in produzione).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}
