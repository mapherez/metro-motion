import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { lineNames, lineOrder } from "@metro/station-data";
import type { LineName } from "@metro/station-data";
import { stationById } from "@metro/station-data/stations";
import type { StationEta } from "@metro/shared-types";

const LABEL_BY_LINE: Record<LineName, string> = {
  azul: "Azul",
  amarela: "Amarela",
  verde: "Verde",
  vermelha: "Vermelha",
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

const REFRESH_INTERVAL_MS = 6000;

function normalizeLineName(id: string | undefined): LineName {
  if (!id) return "azul";
  const normalized = id.toLowerCase();
  const allowed = lineNames as LineName[];
  return allowed.includes(normalized as LineName) ? (normalized as LineName) : "azul";
}

type LineEtaResponse = {
  line: LineName;
  t: number;
  stations: StationEta[];
};

function formatEta(seconds: number): string {
  if (seconds <= 0) return "Chegada";
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export function LineView() {
  const params = useParams();
  const ln = normalizeLineName(params.id);
  const API_BASE = import.meta.env.DEV ? "/api" : import.meta.env.VITE_API_BASE;

  const [lineEtas, setLineEtas] = useState<LineEtaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const tick = () => setNowSec(Math.floor(Date.now() / 1000));
    const id = window.setInterval(tick, 1000);
    tick();
    return () => {
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let isFirstFetch = true;

    const fetchEtas = async () => {
      if (!active) return;
      try {
        if (isFirstFetch) {
          setLoading(true);
        }
        setError(null);
        const res = await fetch(`${API_BASE}/lines/${ln}/etas`);
        if (!active) return;
        if (res.status === 204) {
          setLineEtas(null);
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as LineEtaResponse;
        setLineEtas(json);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Falha ao carregar tempos de chegada");
      } finally {
        if (!active) return;
        if (isFirstFetch) {
          setLoading(false);
          isFirstFetch = false;
        }
        timer = window.setTimeout(fetchEtas, REFRESH_INTERVAL_MS);
      }
    };

    fetchEtas();

    return () => {
      active = false;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [API_BASE, ln]);

  const stationLookup = useMemo(() => {
    const map = new Map<string, StationEta>();
    if (lineEtas?.stations) {
      for (const station of lineEtas.stations) {
        map.set(station.stationId, station);
      }
    }
    return map;
  }, [lineEtas]);

  const nextEta = useCallback(
    (stopId: string) => {
      if (!lineEtas) return "--";
      const station = stationLookup.get(stopId);
      const first = station?.arrivals?.[0];
      if (!first) return "--";
      const elapsed = Math.max(0, nowSec - lineEtas.t);
      const remaining = Math.max(0, first.etaSeconds - elapsed);
      return formatEta(remaining);
    },
    [lineEtas, stationLookup, nowSec]
  );

  return (
    <div className="space-y-4 px-4 py-4">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-muted">Linha</p>
        <h1 className="text-2xl font-semibold">{LABEL_BY_LINE[ln]}</h1>
      </header>
      {error ? (
        <p className="text-sm text-[var(--alert-error)]">{error}</p>
      ) : null}
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
      {loading ? <p className="text-xs text-muted">Atualizando tempos…</p> : null}
      <Link
        to="/"
        className={`inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-[var(--bg-soft)] px-5 text-sm font-medium text-[var(--fg)] transition-colors hover:text-[var(--fg)] ${focusRing}`}
      >
        Voltar ao mapa
      </Link>
    </div>
  );
}
