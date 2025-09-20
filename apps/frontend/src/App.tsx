import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { useSnapshotStore } from "./state";
import { Shell } from "./Shell";
import { Home } from "./views/Home";
import { About } from "./views/About";
import { LineView } from "./views/LineView";
import { ShellContext } from "./shell-context";
import { useTheme } from "./app/providers";

export function App() {
  const API_BASE = import.meta.env.DEV ? "/api" : import.meta.env.VITE_API_BASE;
  const snapshot = useSnapshotStore((s) => s.snapshot);
  const setSnapshot = useSnapshotStore((s) => s.setSnapshot);
  const { theme, setTheme, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sinceText, setSinceText] = useState("");
  const [serviceOpen, setServiceOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    async function loadNow() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/now`);
        if (!active) {return;}
        if (res.status === 204) {
          setSnapshot(null);
          setServiceOpen(null);
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        setSnapshot(json);
        setServiceOpen(json?.serviceOpen === false ? false : true);
      } catch (err: unknown) {
        if (!active) {return;}
        const message = err instanceof Error ? err.message : "Failed to load snapshot";
        setError(message);
        setServiceOpen(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadNow();
    return () => {
      active = false;
    };
  }, [API_BASE, setSnapshot]);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/stream`);
    es.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        setSnapshot(json);
        setServiceOpen(json?.serviceOpen === false ? false : true);
        setError(null);
      } catch (err) {
        console.error("Failed to parse SSE payload", err);
      }
    };
    es.onerror = () => {
      setError((prev) => prev ?? "Realtime disconnected, retrying...");
    };
    return () => {
      es.close();
    };
  }, [API_BASE, setSnapshot]);

  useEffect(() => {
    if (!snapshot || serviceOpen === false) {
      setSinceText("");
      return;
    }
    const update = () => {
      const ageMs = Date.now() - snapshot.t * 1000;
      const seconds = Math.max(0, Math.floor(ageMs / 1000));
      setSinceText(seconds === 1 ? "1s ago" : `${seconds}s ago`);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [snapshot, serviceOpen]);

  const contextValue = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      snapshot,
      serviceOpen,
      sinceText,
      loading,
      error,
    }),
    [theme, setTheme, toggleTheme, snapshot, serviceOpen, sinceText, loading, error]
  );

  return (
    <ShellContext.Provider value={contextValue}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="line/:id" element={<LineView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ShellContext.Provider>
  );
}
