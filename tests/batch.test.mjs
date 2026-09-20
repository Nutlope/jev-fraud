import {test} from 'node:test';import assert from 'node:assert/strict';
import {runBatch} from '../lib/batch.mjs';
import {consumeRun} from '../lib/run-client.mjs';
const emails=Array.from({length:100},(_,i)=>({id:String(i),text:String(i),label:'fraud'}));
test('50 Jev and 25 Kimi calls run independently; all Jev finish while reviews are blocked',async()=>{
 let j=0,k=0,peakJ=0,peakK=0,jevFinished=0;let release;const gate=new Promise(r=>release=r),events=[];
 const run=runBatch(emails,{}, {jevConcurrency:50,onEvent:e=>events.push(e),jev:async()=>{j++;peakJ=Math.max(peakJ,j);await new Promise(r=>setTimeout(r,1));j--;jevFinished++;return {choice:'fraud',confidence:.8}},kimi:async()=>{k++;peakK=Math.max(peakK,k);await gate;k--;return {choice:'fraud'}}});
 for(let i=0;i<100&&jevFinished<100;i++)await new Promise(r=>setTimeout(r,2));
 assert.equal(jevFinished,100);assert.equal(peakJ,50);assert.equal(peakK,25);assert.equal(events.filter(e=>e.type==='result').length,0);assert.equal(events.find(e=>e.type==='jev-complete').classified,100);
 release();const rows=await run;assert.equal(rows.length,100);assert.ok(rows.every(r=>r.final==='fraud'));
});
test('429 reduces concurrency and retries; other errors stay explicit',async()=>{let calls=0;const events=[];const rows=await runBatch(emails.slice(0,1),{}, {jevConcurrency:50,retryDelayMs:1,onEvent:e=>events.push(e),jev:async()=>{if(++calls<3)throw Object.assign(Error('Rate limit'),{status:429});return {choice:'fraud',confidence:1}}});assert.equal(calls,3);assert.deepEqual(events.filter(e=>e.type==='retry').map(e=>e.concurrency),[20,10]);assert.equal(rows[0].final,'fraud');assert.equal(rows[0].retryEvents.length,2)});
test('abort prevents queued calls starting',async()=>{const controller=new AbortController();let calls=0;await runBatch(emails,{}, {jevConcurrency:1,signal:controller.signal,jev:async()=>{calls++;controller.abort();return {choice:'fraud',confidence:1}}});assert.equal(calls,1)});
test('removed hosted endpoint gives an actionable error instead of JSON SyntaxError',async()=>{await assert.rejects(consumeRun(new Response('This hosted copy has been removed.',{status:410}),()=>{}),/local app at http:\/\/localhost:3017/)});
test('stream handles split JSON and missing final newline; rejects truncated runs',async()=>{const bytes=new TextEncoder();const chunks=['{"type":"res','ult","row":{}}\n{"type":"done"}'];const response=new Response(new ReadableStream({start(c){chunks.forEach(s=>c.enqueue(bytes.encode(s)));c.close()}}),{headers:{'content-type':'application/x-ndjson'}});const events=[];await consumeRun(response,e=>events.push(e));assert.deepEqual(events.map(e=>e.type),['result','done']);await assert.rejects(consumeRun(new Response('{"type":"result"}\n',{headers:{'content-type':'application/x-ndjson'}}),()=>{}),/before the run finished/)});
test('rate-limited retries acquire slots at the reduced concurrency',async()=>{
 const attempts=new Map();let activeRetries=0,peakRetries=0;
 const rows=await runBatch(emails.slice(0,50),{}, {jevConcurrency:50,retryDelayMs:1,jev:async text=>{
 const attempt=(attempts.get(text)??0)+1;attempts.set(text,attempt);
 if(attempt===1)throw Object.assign(Error('Rate limit'),{status:429});
 activeRetries++;peakRetries=Math.max(peakRetries,activeRetries);await new Promise(r=>setTimeout(r,1));activeRetries--;
 return {choice:'fraud',confidence:1};
 }});
 assert.equal(rows.length,50);assert.ok(rows.every(r=>r.final==='fraud'));assert.ok(peakRetries<=10);
});
