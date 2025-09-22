import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { destinos, lineNames, lineOrder } from "@metro/station-data";
import type { LineName } from "@metro/station-data";
import { stationById } from "@metro/station-data/stations";
import type { StationEta } from "@metro/shared-types";
import { useShellContext } from "../shell-context";

const LABEL_BY_LINE: Record<LineName, string> = {
  azul: "Azul",
  amarela: "Amarela",
  verde: "Verde",
  vermelha: "Vermelha",
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

const REFRESH_INTERVAL_MS = 6000;
const CLOSED_REFRESH_INTERVAL_MS = 60000;

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
  const { serviceOpen } = useShellContext();

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

    const schedule = (delay: number) => {
      if (!active) return;
      timer = window.setTimeout(fetchEtas, delay);
    };

    const fetchEtas = async () => {
      let nextDelay = REFRESH_INTERVAL_MS;
      if (!active) return;
      if (serviceOpen === false) {
        setLineEtas(null);
        setError(null);
        if (isFirstFetch) {
          setLoading(false);
          isFirstFetch = false;
        }
        nextDelay = CLOSED_REFRESH_INTERVAL_MS;
        schedule(nextDelay);
        return;
      }
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
        schedule(nextDelay);
      }
    };

    fetchEtas();

    return () => {
      active = false;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [API_BASE, ln, serviceOpen]);

  const stationLookup = useMemo(() => {
    const map = new Map<string, StationEta>();
    if (lineEtas?.stations) {
      for (const station of lineEtas.stations) {
        map.set(station.stationId, station);
      }
    }
    return map;
  }, [lineEtas]);

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[var(--bg)]/90 px-4 py-3 backdrop-blur">
        <Link
          to="/"
          className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-[var(--bg-soft)] px-4 py-2 text-sm font-medium text-[var(--fg)] transition-colors hover:text-[var(--fg)] ${focusRing}`}
        >
          <span aria-hidden>&lt;</span>
          <span>Voltar</span>
        </Link>
        <div className="flex flex-col items-end text-right">
          <p className="text-xs uppercase tracking-wide text-muted">Linha</p>
          <p className="text-sm font-semibold text-[var(--fg)]">{LABEL_BY_LINE[ln]}</p>
        </div>
      </header>
      <div className="space-y-4 px-4 py-4">
        {error ? (
          <p className="text-sm text-[var(--alert-error)]">{error}</p>
        ) : null}
        {serviceOpen === false ? (
          <p className="text-sm text-muted">Serviço encerrado (01:00 – 06:30)</p>
        ) : null}
        <ol className="space-y-3">
          {lineOrder[ln].map((stationId) => {
            const station = stationById[stationId];
            const arrivals = stationLookup.get(stationId)?.arrivals ?? [];
            // Get terminal stopIds for this line
            const firstTerminal = lineOrder[ln][0];
            const lastTerminal = lineOrder[ln][lineOrder[ln].length - 1];

            // Find ETA for trains heading to first terminal
            const etaToFirst = arrivals.find(a =>
              a.destinoId !== undefined && destinos[a.destinoId]?.terminal === firstTerminal
            );
            // Find ETA for trains heading to last terminal
            const etaToLast = arrivals.find(a =>
              a.destinoId !== undefined && destinos[a.destinoId]?.terminal === lastTerminal
            );

            const elapsed = Math.max(0, nowSec - (lineEtas?.t ?? 0));
            const format = (a?: typeof etaToFirst) =>
              a ? formatEta(Math.max(0, a.etaSeconds - elapsed)) : "--";

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
                <div className="flex flex-col text-sm text-muted text-right">
                  <span>{`${stationById[firstTerminal]?.name ?? firstTerminal}: ${format(etaToFirst)}`}</span>
                  <span>{`${stationById[lastTerminal]?.name ?? lastTerminal}: ${format(etaToLast)}`}</span>
                </div>
              </li>
            );
          })}
        </ol>
        {loading ? <p className="text-xs text-muted">Atualizando tempos…</p> : null}
      </div>
    </div>
  );
}
