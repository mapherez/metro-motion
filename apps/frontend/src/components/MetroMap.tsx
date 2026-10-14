import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { lineNames, lineOrder } from '@metro/station-data';
import { stationById } from '@metro/station-data/stations';
import { linePaths, viewBox } from '@metro/station-data/geometry';
import type { LineName, Train } from '@metro/shared-types';
import { LINE_COLOR, LINE_LABEL } from '../format';
import { useSnapshotStore } from '../state';
import { renderedMotion, subscribeMotion } from '../motion-engine';

type Geometry = { path:SVGPathElement; length:number; anchors:number[] };
function MapTrain({train,geometry,select}:{train:Train;geometry?:Geometry;select:()=>void}) {
  const ref=useRef<SVGGElement>(null);
  useLayoutEffect(()=>subscribeMotion(at=>{
    if(!ref.current||!geometry)return;
    const sample=renderedMotion(train,at),p=Math.max(0,Math.min(geometry.anchors.length-1,sample.position));
    const index=Math.floor(p),end=Math.min(index+1,geometry.anchors.length-1);
    const s=geometry.anchors[index]+(geometry.anchors[end]-geometry.anchors[index])*(p-index);
    const point=geometry.path.getPointAtLength(s),a=geometry.path.getPointAtLength(Math.max(0,s-2)),b=geometry.path.getPointAtLength(Math.min(geometry.length,s+2));
    const forward=(geometry.anchors[end]-geometry.anchors[Math.max(0,index-Number(end===index))])*train.direction>=0;
    const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+(forward?0:180);
    ref.current.setAttribute('transform',`translate(${point.x},${point.y}) rotate(${angle})`);
    ref.current.style.opacity=String(sample.opacity);ref.current.dataset.phase=sample.phase;
  }),[train,geometry]);
  return <g ref={ref} className="map-train" role="button" tabIndex={0} aria-label={`Comboio ${train.id}, linha ${LINE_LABEL[train.line]}, sentido ${train.dest}. Posição estimada.`} onClick={select} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}}}>
    <rect className="train-focus" x={-22} y={-22} width={44} height={44} rx={8} fill="transparent"/>
    <rect x={-10} y={-6} width={20} height={12} rx={4} fill={LINE_COLOR[train.line]} stroke="#111" strokeWidth={1}/>
    <rect x={-5.5} y={-3} width={3.5} height={6} rx={1} fill="#fff"/><rect x={-1} y={-3} width={3.5} height={6} rx={1} fill="#fff"/>
    <circle cx={10} cy={0} r={1.4} fill="#fff" stroke="#111" strokeWidth={1}/>
  </g>;
}
export function MetroMap() {
  const svgRef=useRef<SVGSVGElement>(null);
  const [geometry,setGeometry]=useState<Partial<Record<LineName,Geometry>>>({});
  const [selected,setSelected]=useState<string|null>(null);
  const snapshot=useSnapshotStore(s=>s.snapshot),now=useSnapshotStore(s=>s.now);
  const navigate=useNavigate(),location=useLocation();
  useLayoutEffect(()=>{
    const svg=svgRef.current;if(!svg)return;
    const next:Partial<Record<LineName,Geometry>>={};
    for(const line of lineNames){
      const path=svg.querySelector(`#${linePaths[line].id}`) as SVGPathElement;
      const length=path.getTotalLength();
      const anchors=lineOrder[line].map(id=>{
        const station=stationById[id];let best=0,distance=Infinity;
        for(let i=0;i<=800;i++){
          const s=length*i/800,p=path.getPointAtLength(s),d=(p.x-(station.cx??0))**2+(p.y-(station.cy??0))**2;
          if(d<distance){best=s;distance=d;}
        }
        return best;
      });
      next[line]={path,length,anchors};
    }
    setGeometry(next);
  },[]);
  const trains=snapshot?lineNames.flatMap(line=>snapshot.lines[line].trains):[];
  const chosen=trains.find(t=>`${t.line}:${t.id}`===selected);
  return <section className="map-panel" aria-label="Mapa geral da rede">
    <div className="map-scroll"><svg ref={svgRef} viewBox={`0 0 ${viewBox.width} ${viewBox.height}`} role="group" aria-label="Mapa do Metro de Lisboa — selecione uma estação" className="metro-map">
      {(['azul','vermelha','amarela','verde'] as LineName[]).map(line=>{
        const definition=linePaths[line];return definition.kind==='stroke'?<path key={line} id={definition.id} d={definition.d} stroke={LINE_COLOR[line]} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>:<path key={line} id={definition.id} d={definition.d} fill={LINE_COLOR[line]} pointerEvents="none"/>;
      })}
      {lineNames.map(line=><g key={line}>{lineOrder[line].map(id=>{
        const station=stationById[id];
        const open=()=>navigate(`/station/${id}`,{state:{background:location}});
        return <g key={`${line}:${id}`} className="map-station" role="button" tabIndex={0} aria-label={`${station.name}, abrir detalhes da estação`} onClick={open} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}}}>
          <circle className="station-hit" cx={station.cx} cy={station.cy} r={16} fill="transparent"/>
          <circle cx={station.cx} cy={station.cy} r={5} fill="#fff" stroke={LINE_COLOR[line]} strokeWidth={4}/>
          <text x={station.labelX??(station.cx??0)+8} y={station.labelY??(station.cy??0)-8} fontSize={10} fill="var(--metro-label)">{station.name}</text>
        </g>;
      })}</g>)}
      <g id="train-layer">{trains.map(train=><MapTrain key={train.journeyId} train={train} geometry={geometry[train.line]} select={()=>setSelected(`${train.line}:${train.id}`)}/>)}</g>
    </svg></div>
    <div className="map-caption"><span><i className="estimated-dot" aria-hidden="true"/>Posições estimadas · selecione uma estação para ver detalhes</span><span>{trains.filter(t=>now<t.validUntil).length} comboios acompanhados</span></div>
    {chosen&&<div className="train-info" role="status"><div><strong>Comboio {chosen.id} · Linha {LINE_LABEL[chosen.line]}</strong><span>Sentido {chosen.dest} · próxima estação: {stationById[chosen.to]?.name??chosen.to}</span><span>{now>=chosen.validUntil?'Dados desatualizados':`Chegada prevista em ${Math.max(0,Math.ceil(chosen.observedAt+chosen.etaNext-now))} s`} · posição estimada</span></div><button className="icon-button" onClick={()=>setSelected(null)} aria-label="Fechar informação do comboio">×</button></div>}
  </section>;
}
