import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { lineNames, lineOrder } from "@metro/station-data";
import type { LineName } from "@metro/station-data";
import { stationById } from "@metro/station-data/stations";
import { useSnapshotStore } from "../state";

const LABEL_BY_LINE: Record<LineName, string> = {
  azul: "Azul",
  amarela: "Amarela",
  verde: "Verde",
  vermelha: "Vermelha",
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

function normalizeLineName(id: string | undefined): LineName {
  if (!id) return "azul";
  const normalized = id.toLowerCase();
  const allowed = lineNames as LineName[];
  return allowed.includes(normalized as LineName) ? (normalized as LineName) : "azul";
}

export function LineView() {
  const params = useParams();
  const ln = normalizeLineName(params.id);
  const { snapshot } = useSnapshotStore();

  const nextEta = useMemo(() => {
    const trains = (snapshot as any)?.lines?.[ln]?.trains ?? [];
    return (stopId: string) => {
      let best = Infinity;
      for (const train of trains) {
        if (train.to === stopId) {
          best = Math.min(best, train.etaNext ?? Infinity);
        }
      }
      if (!isFinite(best)) return "--";
      if (best <= 0) return "Chegada";
      const minutes = Math.floor(best / 60);
      const seconds = Math.floor(best % 60);
      return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    };
  }, [snapshot, ln]);

  return (
    <div className="space-y-4 px-4 py-4">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-muted">Linha</p>
        <h1 className="text-2xl font-semibold">{LABEL_BY_LINE[ln]}</h1>
      </header>
      <ol className="space-y-3">
        {lineOrder[ln].map((stationId) => {
          const station = stationById[stationId];
          return (
            <li
              key={stationId}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[var(--bg-soft)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: `var(--line-${ln})` }}
                />
                <span>{station?.name ?? stationId}</span>
              </div>
              <span className="text-sm text-muted">{nextEta(stationId)}</span>
            </li>
          );
        })}
      </ol>
      <Link
        to="/"
        className={`inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-[var(--bg-soft)] px-5 text-sm font-medium text-[var(--fg)] transition-colors hover:text-[var(--fg)] ${focusRing}`}
      >
        Voltar ao mapa
      </Link>
    </div>
  );
}
