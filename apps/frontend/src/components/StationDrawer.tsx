import { lazy, Suspense, useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { stationMetadata } from '@metro/station-data/metadata';
import type { LineName, StationArrival, StationMetadata } from '@metro/shared-types';
import { useSnapshotStore } from '../state';
import { API_BASE } from '../api';
import { etaText, freshArrivals, LINE_COLOR, LINE_LABEL } from '../format';

const LocationMap=lazy(()=>import('./LocationMap'));
type Details={station:StationMetadata;available:boolean;tiles:{url:string;attribution:string};lines:{line:LineName;arrivals:StationArrival[]}[]};
export function StationDrawer({stationId,hasBackground}:{stationId:string;hasBackground:boolean}) {
  const navigate=useNavigate(),dialogRef=useRef<HTMLDialogElement>(null),closing=useRef(false);
  const gesture=useRef<{x:number;y:number;at:number;active:boolean;pointer:number}|null>(null);
  const [details,setDetails]=useState<Details|null>(null),[error,setError]=useState<string|null>(null);
  const snapshot=useSnapshotStore(s=>s.snapshot),now=useSnapshotStore(s=>s.now),reduced=useSnapshotStore(s=>s.reducedMotion);
  const id=stationId.toUpperCase();
  const station=details?.station??snapshot?.metadata.find(s=>s.id===id)??stationMetadata.find(s=>s.id===id);
  const finishClose=useCallback(()=>{if(hasBackground)navigate(-1);else navigate('/',{replace:true});},[hasBackground,navigate]);
  const close=useCallback(()=>{
    if(closing.current)return;closing.current=true;
    const dialog=dialogRef.current;
    if(!dialog||reduced){finishClose();return;}
    const animation=dialog.animate([{transform:dialog.style.transform||'translateX(0)'},{transform:'translateX(100%)'}],{duration:220,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    void animation.finished.then(finishClose,finishClose);
  },[finishClose,reduced]);
  useEffect(()=>{
    const dialog=dialogRef.current;if(!dialog)return;
    const previous=document.activeElement as HTMLElement|null;
    const previousOverflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow='hidden';
    return()=>{dialog.close();document.body.style.overflow=previousOverflow;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    setDetails(null);setError(null);
    void fetch(`${API_BASE}/stations/${encodeURIComponent(id)}`,{signal:controller.signal}).then(async r=>{
      if(!r.ok)throw new Error();const data=await r.json() as Details;if(active)setDetails(data);
    }).catch(()=>{if(active)setError('Não foi possível atualizar os detalhes. Pode consultar a informação local.');});
    return()=>{active=false;controller.abort();};
  },[id]);
  const down=(event:PointerEvent<HTMLElement>)=>{
    if(event.pointerType==='mouse')return;
    gesture.current={x:event.clientX,y:event.clientY,at:performance.now(),active:false,pointer:event.pointerId};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move=(event:PointerEvent<HTMLElement>)=>{
    const start=gesture.current;if(!start||start.pointer!==event.pointerId)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(!start.active&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){gesture.current=null;return;}
    if(dx>8&&dx>Math.abs(dy)*1.3)start.active=true;
    if(start.active&&dialogRef.current)dialogRef.current.style.transform=`translateX(${Math.max(0,dx)}px)`;
  };
  const up=(event:PointerEvent<HTMLElement>)=>{
    const start=gesture.current;gesture.current=null;if(!start)return;
    const dx=event.clientX-start.x,elapsed=Math.max(1,performance.now()-start.at),width=dialogRef.current?.getBoundingClientRect().width??400;
    if(start.active&&(dx>width*.28||(dx>50&&dx/elapsed>.5)))close();
    else if(dialogRef.current){const dialog=dialogRef.current;dialog.animate([{transform:dialog.style.transform},{transform:'translateX(0)'}],{duration:reduced?0:180,easing:'ease-out'});dialog.style.transform='';}
  };
  const cancel=()=>{gesture.current=null;if(dialogRef.current)dialogRef.current.style.transform='';};
  const swipe={onPointerDown:down,onPointerMove:move,onPointerUp:up,onPointerCancel:cancel};
  return <dialog ref={dialogRef} className="station-drawer" aria-labelledby="station-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{
    if(event.target!==event.currentTarget)return;const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
  }}>
    <div className="swipe-edge" aria-hidden="true" {...swipe}/>
    <header className="drawer-header" {...swipe}><div><p className="eyebrow">Estação</p><h2 id="station-title">{station?.name??'Estação desconhecida'}</h2></div><button className="icon-button close-drawer" onClick={close} aria-label="Fechar detalhes da estação" autoFocus>×</button></header>
    {station?<div className="drawer-content">
      <div className="station-lines">{station.lines.map(line=><button key={line} className="interchange" style={{'--badge-color':LINE_COLOR[line]} as React.CSSProperties} onClick={()=>navigate(`/line/${line}`)}>Linha {LINE_LABEL[line]}</button>)}</div>
      {error&&<p className="notice" role="status">{error}</p>}
      {details?.available===false&&<p className="notice" role="status">Chegadas temporariamente indisponíveis.</p>}
      <section><div className="section-heading"><h3>Próximos comboios</h3><span>Tempos do operador</span></div>
        {snapshot?.serviceOpen===false&&<p className="notice">Serviço encerrado. Horário normal: 06:30–01:00.</p>}
        {station.lines.map(line=>{
          const data=snapshot?.lines[line];
          const raw=data?.stations.find(s=>s.stationId===id)?.arrivals??details?.lines.find(l=>l.line===line)?.arrivals??[];
          const arrivals=freshArrivals(raw,now);
          const groups=new Map<string,StationArrival[]>();
          for(const arrival of arrivals){const key=arrival.destination??'Destino por confirmar';const group=groups.get(key)??[];if(!group.some(a=>a.trainId===arrival.trainId))group.push(arrival);groups.set(key,group);}
          return <div key={line} className="arrival-line"><div className="arrival-line-heading"><span className="line-dot" style={{background:LINE_COLOR[line]}} aria-hidden="true"/><strong>Linha {LINE_LABEL[line]}</strong></div>
            {data?.status.observedAt&&now-data.status.observedAt<120&&<p className="operator-message">{data.status.message}</p>}
            {groups.size?[...groups].map(([destination,items])=><div className="arrival-direction" key={destination}><p>Sentido <strong>{destination}</strong></p><ol className="arrival-times">{items.slice(0,3).map(a=><li key={a.trainId}><strong>{etaText(a,now)}</strong><span>Comboio {a.trainId}{a.leavingService?' · saída de serviço':''}</span></li>)}</ol></div>):<p className="no-data">{raw.length?'Dados desatualizados — a aguardar atualização.':'Sem previsões disponíveis neste momento.'}</p>}
          </div>;
        })}
      </section>
      <section><div className="section-heading"><h3>Horário</h3><span>Exploração normal</span></div><div className="hours-card"><span>Todos os dias</span><strong>{station.hours.opens} — {station.hours.closes}</strong></div>
        {station.hours.secondaryEntrances.map(entrance=><p className="secondary-hours" key={entrance.name}>Átrio {entrance.name}: <strong>{entrance.opens} — {entrance.closes}</strong>. A estação mantém o horário normal através dos restantes acessos.</p>)}
        <a className="source-link" href={station.hours.source} target="_blank" rel="noreferrer">Fonte oficial · verificado em {station.hours.verifiedAt}</a>
      </section>
      <section><div className="section-heading"><h3>Localização</h3><span>OpenStreetMap</span></div>
        {station.lat!==undefined&&station.lon!==undefined?<>
          <Suspense fallback={<div className="map-placeholder">A carregar o mapa…</div>}><LocationMap lat={station.lat} lon={station.lon} name={station.name} tiles={details?.tiles??{url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'© OpenStreetMap contributors'}}/></Suspense>
          <p className="coordinates">{station.lat.toFixed(5)}, {station.lon.toFixed(5)}</p>
          <a className="primary-link" href={`https://www.google.com/maps/search/?api=1&query=${station.lat},${station.lon}`} target="_blank" rel="noreferrer">Abrir no Google Maps ↗</a>
        </>:<p className="no-data">Coordenadas indisponíveis.</p>}
      </section>
      {station.urls.length>0&&<section><h3>Mais informação</h3>{station.urls.map((url,i)=><a key={url} className="official-link" href={url} target="_blank" rel="noreferrer">Página oficial da estação{station.urls.length>1?` · ${i+1}`:''} ↗</a>)}</section>}
      <p className="view-note">As posições dos comboios são estimadas; as previsões e mensagens de circulação são fornecidas pelo Metro de Lisboa.</p>
    </div>:<div className="drawer-content"><p>Esta estação não faz parte do catálogo disponível.</p><button className="primary-link" onClick={close}>Voltar à rede</button></div>}
  </dialog>;
}
