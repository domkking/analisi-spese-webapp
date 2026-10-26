import { formatEur } from "../../core/index.ts";

export interface DonutItem {
  readonly label: string;
  readonly value: number;
}

const PALETTE = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#64748B", "#84CC16"];
const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Grafico a ciambella in SVG puro (nessuna libreria). */
export function Donut({ items }: { items: readonly DonutItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return <p className="muted center">Nessuna spesa registrata</p>;

  let offset = 0;
  const segments = items.map((item, index) => {
    const length = (item.value / total) * CIRCUMFERENCE;
    const segment = { ...item, color: PALETTE[index % PALETTE.length] ?? "#64748B", length, offset };
    offset += length;
    return segment;
  });

  return (
    <div className="donut">
      <svg viewBox="0 0 200 200" role="img" aria-label={`Distribuzione delle spese, totale ${formatEur(total)}`}>
        <g transform="rotate(-90 100 100)">
          {segments.map((s) => (
            <circle
              key={s.label}
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth="28"
              strokeDasharray={`${s.length} ${CIRCUMFERENCE - s.length}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </g>
        <text x="100" y="98" textAnchor="middle" className="donut-total">
          {formatEur(total)}
        </text>
        <text x="100" y="118" textAnchor="middle" className="donut-caption">
          spese
        </text>
      </svg>
      <ul className="legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="dot" style={{ background: s.color }} />
            {s.label} · {Math.round((s.value / total) * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}
