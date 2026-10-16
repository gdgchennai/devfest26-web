// In-memory backend integration test: real HallCoordinator + local D1/DO,
// 20 distinct trusted actors. Auth.js/Next gateway are covered separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { setTimeout as delay } from 'node:timers/promises';
const count=Number(process.argv[2]??1520), rounds=Number(process.argv[3]??200);
assert.ok(Number.isInteger(count)&&count>=1&&count<=2020);
assert.ok(Number.isInteger(rounds)&&rounds>=1&&rounds<=200);
const output=process.argv[4]??'/tmp/hall-concurrent-local.json';
const bundled=await build({stdin:{contents:`import {HallCoordinator} from './workers/hall-live/index.ts'; export {HallCoordinator}; export default {fetch(r,env){return env.HALL.get(env.HALL.idFromName('rehearsal')).fetch(r)}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers']});
const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:0,workers:[{name:'rehearsal',modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-01',d1Databases:{DB:'rehearsal'},durableObjects:{HALL:{className:'HallCoordinator',useSQLite:true}}}]}));
const report={started:new Date().toISOString(),localOnly:true,authBypassedAtTrustedBackend:true,productionActorLimit:90,clients:count,actors:20,rounds,committed:0,conflicts:0,statuses:{},unexpectedCloses:0,gaps:0,regressions:0};
const clients=[], all=new Set(), intentional=new WeakSet(), times=new Map(),latencies=[],first=[];
let base, state;
const stable=s=>JSON.stringify([s.revision,s.occupancy,s.sessions,s.promotions,s.clock]);
const actors=Array.from({length:20},(_,i)=>({id:`rehearsal:${i}`,organizer:true}));
const zones=['d7-auditorium','d7-amphitheater'];
const start=performance.now();
const hard=setTimeout(()=>{report.error='Global timeout';fs.writeFileSync(output,JSON.stringify(report,null,2));process.exit(1);},900000);
async function connect(c){await new Promise((resolve,reject)=>{
 const t=performance.now(),ws=new WebSocket(base.replace(/^http/,'ws')+'/socket');c.ws=ws;all.add(ws);let initial=true;
 const timer=setTimeout(()=>reject(new Error('Snapshot timeout')),15000);
 ws.onmessage=e=>{const s=JSON.parse(e.data);if(!initial && s.revision>c.state.revision+1)report.gaps+=s.revision-c.state.revision-1;if(c.state && s.revision<c.state.revision)report.regressions++;c.state=s;if(times.has(s.revision))latencies.push(performance.now()-times.get(s.revision));if(initial){first.push(performance.now()-t);initial=false;clearTimeout(timer);resolve();}};
 ws.onerror=()=>{clearTimeout(timer);reject(new Error('Socket error'));};ws.onclose=()=>{all.delete(ws);if(!intentional.has(ws))report.unexpectedCloses++;};
});}
async function write(actor,zone,expected,occupied){
 const t=performance.now(); // Match to actual committed revision after the response; broadcast may precede response.
 const r=await mf.dispatchFetch('http://localhost/write',{method:'POST',body:JSON.stringify({actor,mutation:{kind:'occupancy',zone,expected,occupied}})});
 report.statuses[r.status]=(report.statuses[r.status]??0)+1;
 const body=await r.json();return {status:r.status,body,t};
}
try{
 await mf.ready; base=(await mf.ready).origin;
 const db=await mf.getD1Database('DB');
 for(const file of ['migrations/0014_hall_live.sql','migrations/0015_hall_manual_sessions.sql']){
  const sql=fs.readFileSync(file,'utf8').replace(/^--.*$/gm,'');
  await db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 }
 state=await(await mf.dispatchFetch('http://localhost/snapshot')).json();
 for(let i=0;i<count;i+=25){const batch=Array.from({length:Math.min(25,count-i)},()=>({state:null,ws:null}));clients.push(...batch);await Promise.all(batch.map(connect));}
 report.peakOpen=clients.filter(c=>c.ws.readyState===1).length;assert.equal(report.peakOpen,count);
 // Deliberate same-zone race with one revision: exactly one writer may commit.
 times.set(state.revision+1,performance.now());
 const race=await Promise.all(actors.map((a,i)=>write(a,zones[0],0,i)));
 assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(race.filter(r=>r.status===409).length,19);
 report.conflicts=19;report.racePassed=true;state=race.find(r=>r.status===200).body;
 // Two zones written concurrently; ten pairs per round give all 20 actors a turn.
 // Each actor writes at most once per 1.2-second round (< 51/minute).
 for(let round=0;round<rounds;round++){
  const began=performance.now();
  for(let i=0;i<20;i+=2){
   const before=state.revision, t=performance.now();times.set(before+1,t);times.set(before+2,t);
   const pair=await Promise.all([0,1].map(j=>write(actors[i+j],zones[j],state.occupancy.find(o=>o.zone===zones[j])?.revision??0,(round+i+j)%101)));
   for(const r of pair)assert.equal(r.status,200,JSON.stringify(r.body));
   state=pair.reduce((a,r)=>r.body.revision>a.revision?r.body:a,state);report.committed+=2;
  }
  if(round===Math.floor(rounds/2)){
   const surge=clients.slice(0,Math.min(300,count));
   await Promise.all(surge.map(c=>new Promise(resolve=>{intentional.add(c.ws);c.ws.addEventListener('close',resolve,{once:true});c.ws.close(1000,'Rejoin');})));
   await Promise.all(surge.map(connect));report.reconnected=surge.length;
  }
  if(round%20===0)console.log(`Round ${round}/${rounds}, commits ${report.committed}`);
  assert.equal(report.unexpectedCloses,0);
  await delay(Math.max(0,1200-(performance.now()-began)));
 }
 const deadline=Date.now()+5000;while(clients.some(c=>stable(c.state)!==stable(state))&&Date.now()<deadline)await delay(25);
 report.converged=clients.filter(c=>stable(c.state)===stable(state)).length;assert.equal(report.converged,count);assert.equal(report.gaps,0);assert.equal(report.regressions,0);
 const audit=await db.prepare('SELECT count(*) n,count(DISTINCT actor) actors FROM hall_audit').first();report.audit=audit;assert.equal(audit.n,report.committed+1);assert.equal(audit.actors,20);
 console.log('Soaking');await delay(rounds===1?1000:120000);assert.equal(report.unexpectedCloses,0);report.soakSeconds=rounds===1?1:120;report.result='PASS';
} catch(e){report.result='FAIL';report.error=e.message;process.exitCode=1;}
finally{
 for(const ws of all){intentional.add(ws);ws.close(1000,'Complete');}await delay(1000);await mf.dispose();clearTimeout(hard);
 const pct=(a,p)=>{a.sort((x,y)=>x-y);return a[Math.floor((a.length-1)*p)]??null;};
 report.propagationMs={p50:pct(latencies,.5),p95:pct(latencies,.95),p99:pct(latencies,.99),samples:latencies.length};report.initialSnapshotMs={p95:pct(first,.95),samples:first.length};report.elapsedSeconds=(performance.now()-start)/1000;report.loadGeneratorRSS=process.memoryUsage().rss;
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
