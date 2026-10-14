import type { Snapshot, Train } from '@metro/shared-types';
import { planMotion, sampleMotion, type MotionSample } from '@metro/shared-utils';
import { useSnapshotStore } from './state';

const tracks = new Map<string,Train>();
const signatures = new Map<string,string>();
const frozen = new Map<string,MotionSample>();
const listeners = new Set<(at: number) => void>();
let frame = 0;
let clockOffset = 0;
let lastReceivedAt = -Infinity;
let lastSecond = 0;
let running = false;
export const motionKey = (train: Train) => `${train.line}:${train.id}`;
export const motionNow = () => Date.now()/1000 + clockOffset;

export function renderedMotion(train: Train, at = motionNow()): MotionSample {
  const key = motionKey(train);
  const { paused,reducedMotion } = useSnapshotStore.getState();
  if ((paused || reducedMotion) && frozen.has(key)) return frozen.get(key)!;
  const sample = sampleMotion(tracks.get(key) ?? train,at);
  if (paused || reducedMotion) frozen.set(key,sample);
  return sample;
}
export function ingestSnapshot(snapshot: Snapshot) {
  if (snapshot.receivedAt < lastReceivedAt) return;
  if (lastReceivedAt === -Infinity) clockOffset = snapshot.receivedAt - Date.now()/1000;
  lastReceivedAt = snapshot.receivedAt;
  const now = motionNow(), keys = new Set<string>();
  for (const line of Object.values(snapshot.lines)) for (const train of line.trains) {
    const key=motionKey(train); keys.add(key);
    const signature=`${train.journeyId}:${train.observedAt}:${train.retiringAt ?? ''}`;
    if (signatures.get(key) === signature) continue;
    const previous=tracks.get(key);
    let next=train;
    if (previous?.journeyId === train.journeyId && !train.retiringAt && now < previous.validUntil) {
      const current=sampleMotion(previous,now);
      const target=train.segments[train.segments.length-1];
      const segments=planMotion(current.position,current.velocity,target.to,target.endAt,now,train.direction);
      if (segments) next={...train,segments};
    }
    tracks.set(key,next);signatures.set(key,signature);
    if (useSnapshotStore.getState().reducedMotion && !useSnapshotStore.getState().paused) frozen.delete(key);
  }
  for (const key of tracks.keys()) if(!keys.has(key)){tracks.delete(key);signatures.delete(key);frozen.delete(key);}
  useSnapshotStore.setState({snapshot,loading:false,connected:true,error:null,now});
  draw();
}
function draw() {
  const now=motionNow();
  for(const listener of listeners) listener(now);
  const second=Math.floor(now);
  if(second!==lastSecond){lastSecond=second;useSnapshotStore.setState({now});}
}
function tick() {
  if(!running)return;
  draw();frame=requestAnimationFrame(tick);
}
function start() {
  if(running||document.hidden)return;
  running=true;frame=requestAnimationFrame(tick);
}
function stop() {running=false;cancelAnimationFrame(frame);}
export function subscribeMotion(listener:(at:number)=>void) { listeners.add(listener);listener(motionNow());return()=>{listeners.delete(listener);}; }
export function startMotionEngine() {
  const visibility=()=>{if(document.hidden)stop();else{draw();start();}};
  const unsubscribe=useSnapshotStore.subscribe((state,previous)=>{
    if(state.paused!==previous.paused||state.reducedMotion!==previous.reducedMotion){
      if(!state.paused&&!state.reducedMotion)frozen.clear();draw();
    }
  });
  document.addEventListener('visibilitychange',visibility);start();
  return()=>{stop();unsubscribe();document.removeEventListener('visibilitychange',visibility);};
}
