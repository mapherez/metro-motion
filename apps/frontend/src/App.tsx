import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Snapshot } from "@metro/shared-types";
import { API_BASE } from "./api";
import { adaptiveView, saved, useSnapshotStore } from "./state";
import {
  ingestSnapshot,
  startMotionEngine,
  synchronizeClock,
} from "./motion-engine";
import { Shell } from "./Shell";
import { Home } from "./views/Home";
import { LineView } from "./views/LineView";
import { About } from "./views/About";
import { StationDrawer } from "./components/StationDrawer";

function Connection() {
  const theme = useSnapshotStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => {
    const stop = startMotionEngine();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const layout = matchMedia("(min-width: 1200px) and (pointer: fine)");
    const systemTheme = matchMedia("(prefers-color-scheme: dark)");
    const changeReduced = () =>
      useSnapshotStore.setState({ reducedMotion: reduced.matches });
    const changeLayout = () => {
      if (!saved("metro-view"))
        useSnapshotStore.setState({ view: adaptiveView() });
    };
    const changeTheme = () => {
      if (!saved("metro-theme"))
        useSnapshotStore.setState({
          theme: systemTheme.matches ? "dark" : "light",
        });
    };
    reduced.addEventListener("change", changeReduced);
    layout.addEventListener("change", changeLayout);
    systemTheme.addEventListener("change", changeTheme);
    const controller = new AbortController();
    let active = true;
    const requestStart = performance.now();
    void fetch(`${API_BASE}/now`, { signal: controller.signal })
      .then(async (response) => {
        if (active)
          synchronizeClock(
            Number(response.headers.get("X-Server-Time")) +
              (performance.now() - requestStart) / 2000,
          );
        if (response.status === 204) {
          if (active) useSnapshotStore.setState({ loading: false });
          return;
        }
        if (!response.ok) throw new Error();
        const parsed = Snapshot.parse(await response.json());
        if (active) ingestSnapshot(parsed);
      })
      .catch(() => {
        if (active)
          useSnapshotStore.setState({
            loading: false,
            error: "Não foi possível obter os dados. A tentar novamente…",
          });
      });
    const stream = new EventSource(`${API_BASE}/stream`);
    stream.onopen = () => useSnapshotStore.setState({ connected: true });
    stream.onmessage = (event) => {
      try {
        ingestSnapshot(Snapshot.parse(JSON.parse(event.data)));
      } catch {
        useSnapshotStore.setState({
          error: "Recebemos dados inválidos. A aguardar atualização.",
        });
      }
    };
    stream.onerror = () =>
      useSnapshotStore.setState({
        connected: false,
        error: "Ligação interrompida. A tentar novamente…",
      });
    return () => {
      active = false;
      controller.abort();
      stream.close();
      stop();
      reduced.removeEventListener("change", changeReduced);
      layout.removeEventListener("change", changeLayout);
      systemTheme.removeEventListener("change", changeTheme);
    };
  }, []);
  return null;
}
function Screens() {
  const location = useLocation();
  const state = location.state as {
    background?: typeof location;
    drawer?: boolean;
  } | null;
  const stationMatch = location.pathname.match(/^\/station\/([^/]+)\/?$/);
  const background = stationMatch
    ? (state?.background ?? { ...location, pathname: "/" })
    : location;
  return (
    <>
      <Routes location={background}>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="line/:id" element={<LineView />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
      {stationMatch && (
        <StationDrawer
          stationId={decodeURIComponent(stationMatch[1])}
          hasBackground={!!state?.background}
        />
      )}
    </>
  );
}
export function App() {
  return (
    <BrowserRouter>
      <Connection />
      <Screens />
    </BrowserRouter>
  );
}
