import { useEffect } from "react";

import { useApp, type Notice } from "../../state/AppContext.tsx";

function Toast({ notice }: { notice: Notice }) {
  const { dismiss } = useApp();
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(notice.id), notice.kind === "error" ? 12_000 : 8_000);
    return () => window.clearTimeout(timer);
  }, [dismiss, notice.id, notice.kind]);

  return (
    <div className={`toast toast-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
      <span>{notice.text}</span>
      <button type="button" className="icon-btn" aria-label="Chiudi messaggio" onClick={() => dismiss(notice.id)}>
        ✕
      </button>
    </div>
  );
}

export function Notices() {
  const { notices } = useApp();
  return (
    <div className="notices" aria-live="polite">
      {notices.map((notice) => (
        <Toast key={notice.id} notice={notice} />
      ))}
    </div>
  );
}
