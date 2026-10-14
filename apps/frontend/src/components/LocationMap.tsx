import { useEffect, useRef } from 'react';
import { circleMarker, map, tileLayer } from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props={lat:number;lon:number;name:string;tiles:{url:string;attribution:string}};
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export default function LocationMap({lat,lon,name,tiles}:Props) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current)return;
    const instance=map(ref.current,{scrollWheelZoom:false}).setView([lat,lon],16);
    const url=tiles.url.startsWith('https://')?tiles.url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    tileLayer(url,{maxZoom:19,attribution:`${escapeHtml(tiles.attribution)} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Licença OSM</a>`}).addTo(instance);
    const label=document.createElement('span');label.textContent=name;
    circleMarker([lat,lon],{radius:9,color:'#172c41',weight:3,fillColor:'#fff',fillOpacity:1}).bindTooltip(label).addTo(instance);
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(ref.current);
    return()=>{observer.disconnect();instance.remove();};
  },[lat,lon,name,tiles.url,tiles.attribution]);
  return <div ref={ref} className="location-map" role="region" aria-label={`Localização de ${name}. Mapa interativo.`}/>;
}
