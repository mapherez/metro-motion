import type { LineName, StationArrival } from '@metro/shared-types';
export const LINE_LABEL: Record<LineName,string> = { azul:'Azul',amarela:'Amarela',verde:'Verde',vermelha:'Vermelha' };
export const LINE_COLOR: Record<LineName,string> = { azul:'#467DED',amarela:'#FFB83B',verde:'#07AC56',vermelha:'#E7343F' };
export function etaText(arrival:StationArrival, now:number) {
  if(arrival.observedAt===undefined||now-arrival.observedAt>=30)return '—';
  const seconds=Math.max(0,Math.ceil((arrival.arrivalAt ?? arrival.observedAt+arrival.etaSeconds)-now));
  return seconds===0?'A chegar':`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
export function freshArrivals(arrivals:StationArrival[],now:number) {
  return arrivals.filter(a=>a.observedAt!==undefined&&now-a.observedAt<30).sort((a,b)=>(a.arrivalAt??Infinity)-(b.arrivalAt??Infinity));
}
