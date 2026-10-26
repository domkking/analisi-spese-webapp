export type Tone = "neutral" | "ok" | "warn" | "bad";

export function Kpi({ title, value, sub, tone = "neutral" }: { title: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div className="card kpi">
      <div className="kpi-title">{title}</div>
      <div className={`kpi-value tone-${tone}`}>{value}</div>
      {sub !== undefined && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
