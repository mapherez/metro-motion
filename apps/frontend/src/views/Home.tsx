import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { MetroMap } from "../components/MetroMap";

const LINES = [
  { id: "azul", label: "Azul", color: "var(--line-azul)" },
  { id: "amarela", label: "Amarela", color: "var(--line-amarela)" },
  { id: "verde", label: "Verde", color: "var(--line-verde)" },
  { id: "vermelha", label: "Vermelha", color: "var(--line-vermelha)" },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

const desktopMapStyle: CSSProperties = {
  minHeight: "calc(100dvh - var(--shell-header-height, 0px) - var(--shell-footer-height, 0px))",
};

export function Home() {
  return (
    <div className="flex h-full flex-col">
      <div className="hidden md:flex md:flex-1" style={desktopMapStyle}>
        <div className="flex min-h-0 flex-1">
          <MetroMap />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 md:hidden">
        {LINES.map((line) => (
          <Link
            key={line.id}
            to={`/line/${line.id}`}
            aria-label={`Abrir linha ${line.label}`}
            className={`aspect-square min-h-11 min-w-11 rounded-2xl border border-white/10 bg-[var(--bg-soft)] shadow flex flex-col items-center justify-center gap-3 text-lg font-semibold transition duration-150 hover:scale-[1.02] hover:text-[var(--fg)] ${focusRing}`}
          >
            <span
              className="rounded px-4 py-2 text-sm font-medium text-white"
              style={{ background: line.color }}
            >
              {line.label}
            </span>
            <span className="text-xs text-muted">Ver paragens e ETAs</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
