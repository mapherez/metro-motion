import { Link } from 'react-router-dom';
import { lineNames, lineOrder } from '@metro/station-data';
import { stationById } from '@metro/station-data/stations';
import { MetroMap } from '../components/MetroMap';
import { LINE_COLOR, LINE_LABEL } from '../format';
import { useSnapshotStore } from '../state';

export function Home() {
  const {view,setView,snapshot,now}=useSnapshotStore();
  return <div className={`home-view ${view==='map'?'map-home':''}`}>
    <div className="page-heading"><div><p className="eyebrow">A rede, neste momento</p><h1>O seu próximo metro.</h1><p className="lead">Consulte chegadas e acompanhe a circulação estimada.</p></div>
      <div className="view-switch" role="group" aria-label="Vista da rede"><button aria-pressed={view==='map'} onClick={()=>setView('map')}>Mapa</button><button aria-pressed={view==='lines'} onClick={()=>setView('lines')}>Linhas</button></div>
    </div>
    {view==='map'?<MetroMap/>:<div className="line-grid">
      {lineNames.map(line=>{
        const data=snapshot?.lines[line];
        const stale=!data?.dataObservedAt||now-data.dataObservedAt>=30;
        const normal=data?.status.summary==='normal';
        const statusFresh=!!data?.status.observedAt&&now-data.status.observedAt<120;
        return <Link key={line} to={`/line/${line}`} className="line-card" style={{'--line-color':LINE_COLOR[line]} as React.CSSProperties}>
          <div className="card-top"><span className="line-badge">Linha {LINE_LABEL[line]}</span><span className="card-arrow" aria-hidden="true">↗</span></div>
          <h2>{LINE_LABEL[line]}</h2><p className="line-endpoints">{stationById[lineOrder[line][0]].name} <span aria-hidden="true">↔</span> {stationById[lineOrder[line][lineOrder[line].length-1]].name}</p>
          <div className="card-bottom"><span>{lineOrder[line].length} estações</span><span className={stale?'muted':normal?'status-normal':'status-alert'}>{snapshot?.serviceOpen===false?'Serviço encerrado':stale?'Sem dados atuais':statusFresh?data?.status.message:'Chegadas disponíveis'}</span></div>
        </Link>;
      })}
    </div>}
  </div>;
}
