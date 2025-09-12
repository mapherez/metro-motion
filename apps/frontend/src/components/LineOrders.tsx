import { lineNames, lineOrder } from '@metro/station-data';

const lineLabel: Record<string, string> = {
  verde: 'Verde',
  azul: 'Azul',
  amarela: 'Amarela',
  vermelha: 'Vermelha'
};

const lineColor: Record<string, string> = {
  verde: '#2ecc71',
  azul: '#3498db',
  amarela: '#f1c40f',
  vermelha: '#e74c3c'
};

export function LineOrders() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      {lineNames.map((ln) => (
        <div key={ln} style={{ border: '1px solid #4443', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: lineColor[ln] }} />
            <strong>{lineLabel[ln]}</strong>
          </div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {lineOrder[ln].map((sid) => (
              <li key={sid} style={{ fontFamily: 'ui-monospace, monospace' }}>{sid}</li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

