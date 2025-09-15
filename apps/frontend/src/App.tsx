import { useEffect, useMemo, useState } from 'react';
import { useSnapshotStore } from './state';
import { LineOrders } from './components/LineOrders';
import { MetroMap } from './components/MetroMap';
import { Snapshot as SnapshotSchema, type Snapshot } from '@metro/shared-types';

export function App() {
  const API_BASE = import.meta.env.BACKEND_URL;
  const { snapshot } = useSnapshotStore();
  const setSnapshot = useSnapshotStore((s) => s.setSnapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [since, setSince] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function loadNow() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/now`);
        if (res.status === 204) {
          if (!cancelled) setSnapshot(null);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const parsed = SnapshotSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error('Invalid snapshot schema');
        }
        if (!cancelled) setSnapshot(parsed.data as Snapshot);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load snapshot');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadNow();
    return () => {
      cancelled = true;
    };
  }, [setSnapshot]);

  // Realtime SSE
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/stream`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        const parsed = SnapshotSchema.safeParse(data);
        if (parsed.success) {
          setSnapshot(parsed.data as Snapshot);
          setError(null);
        }
      } catch (e) {
        // ignore parse errors
      }
    };
    es.onerror = () => {
      // EventSource will auto-retry; surface a lightweight hint
      setError((e) => e ?? 'Realtime disconnected, retrying…');
    };
    return () => es.close();
  }, [setSnapshot]);

  // Since string
  useEffect(() => {
    const id = setInterval(() => {
      if (!snapshot) {
        setSince('');
        return;
      }
      const ageMs = Date.now() - snapshot.t * 1000;
      const s = Math.floor(ageMs / 1000);
      setSince(s + 's ago');
    }, 1000);
    return () => clearInterval(id);
  }, [snapshot]);
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e5e7eb', padding: '10px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
          <div />
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Metro Lisboa Live</h1>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#374151' }}>
            <span>
              {snapshot ? new Date(snapshot.t * 1000).toLocaleTimeString() : '-'}
              {since ? ` • ${since}` : ''}
              {loading ? ' • loading…' : ''}
            </span>
            {error ? (<span style={{ color: 'tomato', marginLeft: 6 }}>• {error}</span>) : null}
          </div>
        </div>
      </header>      
      {/* <section style={{ marginTop: 16 }}>
        <strong>Snapshot time:</strong>{' '}
        {snapshot ? new Date(snapshot.t * 1000).toLocaleTimeString() : '—'}
        {loading ? ' (loading...)' : ''}
        {since ? ` • ${since}` : ''}
        {error ? <span style={{ color: 'tomato' }}> • {error}</span> : null}
      </section> */}
      {/* <section style={{ marginTop: 24 }}>
        <LineOrders />
      </section> */}
      <section style={{ marginTop: 24 }}>
        <MetroMap />
      </section>
    </div>
  );
}
