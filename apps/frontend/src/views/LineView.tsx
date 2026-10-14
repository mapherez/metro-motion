import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { lineNames, lineOrder } from '@metro/station-data';
import { stationById } from '@metro/station-data/stations';
import type { LineName, Train } from '@metro/shared-types';
import { useSnapshotStore } from '../state';
import { etaText, freshArrivals, LINE_COLOR, LINE_LABEL } from '../format';
import { renderedMotion, subscribeMotion } from '../motion-engine';

function RailTrain({train,centers}:{train:Train;centers:number[]}) {
  const ref=useRef<HTMLButtonElement>(null);
  const [selected,setSelected]=useState(false);
  useLayoutEffect(()=>subscribeMotion(at=>{
    const element=ref.current;if(!element||centers.length===0)return;
    const sample=renderedMotion(train,at),p=Math.max(0,Math.min(centers.length-1,sample.position));
    const index=Math.floor(p),last=Math.min(index+1,centers.length-1);
    const y=centers[index]+(centers[last]-centers[index])*(p-index);
    element.style.transform=`translate(${train.direction===1?10:-10}px, ${y}px)`;
    element.style.opacity=String(sample.opacity);element.dataset.phase=sample.phase;
  }),[train,centers]);
  return <button ref={ref} className={`rail-train ${selected?'selected':''}`} aria-label={`Comboio ${train.id}, sentido ${train.dest}. Posição estimada.`} aria-pressed={selected} onClick={()=>setSelected(!selected)} title={`${train.id} → ${train.dest}`}><span aria-hidden="true">{train.direction===1?'↓':'↑'}</span>{selected&&<span className="rail-train-label">{train.id} · {train.dest}</span>}</button>;
}
export function LineView() {
  const {id}=useParams();const normalized=id?.toLowerCase() as LineName;
  const line=lineNames.includes(normalized)?normalized:undefined;
  const snapshot=useSnapshotStore(s=>s.snapshot),now=useSnapshotStore(s=>s.now);
  const location=useLocation(),navigate=useNavigate();
  const listRef=useRef<HTMLOListElement>(null),rowRefs=useRef(new Map<string,HTMLButtonElement>());
  const [centers,setCenters]=useState<number[]>([]);
  useLayoutEffect(()=>{
    const list=listRef.current;if(!list||!line)return;
    const measure=()=>{
      const bounds=list.getBoundingClientRect();
      setCenters(lineOrder[line].map(id=>{const row=rowRefs.current.get(id);const rect=row?.getBoundingClientRect();return rect?rect.top-bounds.top+rect.height/2:0;}));
    };
    const observer=new ResizeObserver(measure);observer.observe(list);for(const row of rowRefs.current.values())observer.observe(row);measure();
    return()=>observer.disconnect();
  },[line]);
  if(!line)return <div className="empty-state"><h1>Linha desconhecida</h1><Link to="/">Voltar à rede</Link></div>;
  const data=snapshot?.lines[line],stale=!data?.dataObservedAt||now-data.dataObservedAt>=30;
  return <section className="line-view" style={{'--line-color':LINE_COLOR[line]} as React.CSSProperties}>
    <div className="page-heading"><div><Link to="/" className="back-link">← Rede do Metro</Link><h1><span className="heading-dot" aria-hidden="true"/>Linha {LINE_LABEL[line]}</h1><p className="lead">{lineOrder[line].length} estações · ambos os sentidos</p></div><span className="line-state">{snapshot?.serviceOpen===false?'Serviço encerrado':stale?'Sem dados atuais':data?.status.observedAt&&now-data.status.observedAt<120?data.status.message:'Chegadas em direto'}</span></div>
    <p className="rail-help">Toque numa estação para ver os próximos comboios e a localização.</p>
    <ol ref={listRef} className="station-list">
      <div className="vertical-rail" aria-hidden="true" style={{top:centers[0]??0,height:Math.max(0,(centers[centers.length-1]??0)-(centers[0]??0))}}/>
      <div className="rail-trains">{data?.trains.map(train=><RailTrain key={train.journeyId} train={train} centers={centers}/>)}</div>
      {lineOrder[line].map(stationId=>{
        const station=snapshot?.metadata.find(s=>s.id===stationId)??stationById[stationId];
        const arrivals=freshArrivals(data?.stations.find(s=>s.stationId===stationId)?.arrivals??[],now);
        const next=[...new Map(arrivals.map(a=>[`${a.direction}:${a.destinoId}`,a]).reverse()).values()].slice(0,2);
        return <li key={stationId}><button ref={element=>{if(element)rowRefs.current.set(stationId,element);else rowRefs.current.delete(stationId);}} className="station-row" onClick={()=>navigate(`/station/${stationId}`,{state:{background:location}})}>
          <span className="station-dot" aria-hidden="true"/><span className="station-name">{station.name}<span className="interchanges">{station.lines.filter(l=>l!==line).map(l=><span key={l} className="interchange" style={{'--badge-color':LINE_COLOR[l]} as React.CSSProperties}>Linha {LINE_LABEL[l]}</span>)}</span></span>
          <span className="station-etas">{next.length?next.map(a=><span key={`${a.direction}:${a.destinoId}`}><span className="destination-label">{a.destination||'Destino por confirmar'}</span><strong>{etaText(a,now)}</strong></span>):<span className="no-arrivals">—</span>}</span><span className="row-chevron" aria-hidden="true">›</span>
        </button></li>;
      })}
    </ol><p className="view-note">As posições na linha são estimadas. Os tempos de chegada vêm do Metro de Lisboa.</p>
  </section>;
}
