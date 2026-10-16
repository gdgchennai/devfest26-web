import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import {moduleUrl} from './model-tests.mjs';
const original={document:globalThis.document,location:globalThis.location,WebSocket:globalThis.WebSocket,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
const state=[],listeners=new Map(),timers=[];
globalThis.__hallHookTest={useEffect:fn=>{globalThis.__hallHookCleanup=fn();},useState:initial=>{const index=state.length;state.push(initial);return [initial,value=>{state[index]=typeof value==='function'?value(state[index]):value;}];}};
const react='data:text/javascript,'+encodeURIComponent('export const {useEffect,useState}=globalThis.__hallHookTest;');
const model=moduleUrl(path.resolve('lib/hall-model.ts'));
const code=ts.transpileModule(fs.readFileSync('components/halls/useHallLive.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('from "react"',`from "${react}"`).replace('from "@/lib/hall-model"',`from "${model}"`);
const sockets=[];
class Socket {
  static OPEN=1;
  constructor(){this.readyState=0;this.closed=0;sockets.push(this);}
  close(){this.readyState=2;this.closed++;}
}
globalThis.document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
globalThis.location={protocol:'http:',host:'localhost:8787'};
globalThis.WebSocket=Socket;
globalThis.setTimeout=fn=>{timers.push(fn);return timers.length;};
globalThis.clearTimeout=()=>{};
globalThis.setInterval=()=>1;
globalThis.clearInterval=()=>{};
try {
  const {useHallLive:runHook}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  runHook();assert.equal(sockets.length,1);
  const first=sockets[0];first.readyState=1;
  first.onmessage({data:JSON.stringify({revision:1,serverNow:1000,clock:null,occupancy:[],promotions:[]})});
  assert.equal(state[1],true);
  document.hidden=true;listeners.get('visibilitychange')();
  document.hidden=false;listeners.get('visibilitychange')();
  assert.equal(sockets.length,2);
  // A delayed closure from the old generation must not create another reconnect.
  first.onclose();assert.equal(timers.length,0);
  first.onerror();assert.equal(sockets[1].closed,0);
  first.onmessage({data:JSON.stringify({revision:99})});assert.equal(state[0].revision,1);
  sockets[1].readyState=1;listeners.get('visibilitychange')();assert.equal(sockets.length,2);
  globalThis.__hallHookCleanup();assert.equal(sockets[1].closed,1);assert.equal(listeners.size,0);
  console.log('Client lifecycle: rapid hide/show, obsolete close/error/messages, duplicate visibility and cleanup passed.');
} finally {Object.assign(globalThis,original);delete globalThis.__hallHookTest;delete globalThis.__hallHookCleanup;}
