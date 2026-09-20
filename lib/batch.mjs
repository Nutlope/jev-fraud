import {classifyJev,classifyKimi,shouldEscalate,THRESHOLD} from './pipeline.mjs';
export const CONCURRENCY={jev:20,kimi:25};
function queue(initial){let active=0,limit=initial;const waiting=[];function drain(){while(active<limit&&waiting.length){const {work,resolve,reject}=waiting.shift();active++;Promise.resolve().then(work).then(resolve,reject).finally(()=>{active--;drain()})}}return {run:work=>new Promise((resolve,reject)=>{waiting.push({work,resolve,reject});drain()}),reduce(){limit=limit>20?20:Math.min(limit,10);return limit}};}
function delay(ms,signal){return new Promise((resolve,reject)=>{if(signal.aborted)return reject(signal.reason);const stop=()=>{clearTimeout(timer);reject(signal.reason)};const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve()},ms);signal.addEventListener('abort',stop,{once:true})})}
/** Independent pools: a slow review never occupies a Jev slot. */
export async function runBatch(emails,env,{threshold=THRESHOLD,onEvent=()=>{},signal,jevConcurrency=CONCURRENCY.jev,kimiConcurrency=CONCURRENCY.kimi,jev=classifyJev,kimi=classifyKimi,retryDelayMs=1000}={}){
 for(const value of [jevConcurrency,kimiConcurrency])if(!Number.isInteger(value)||value<1||value>100)throw Error('Invalid concurrency');
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});const runSignal=controller.signal;
 const pools={jev:queue(jevConcurrency),kimi:queue(kimiConcurrency)},blockedUntil={jev:0,kimi:0},rows=[],reviews=[];let jevCount=0;
 async function invoke(kind,row,fn){for(let attempt=1;attempt<=3;attempt++){runSignal.throwIfAborted();try{return await pools[kind].run(async()=>{runSignal.throwIfAborted();let wait;while((wait=blockedUntil[kind]-Date.now())>0)await delay(wait,runSignal);runSignal.throwIfAborted();onEvent({type:'stage',id:row.id,stage:kind});return fn(row.text,env,runSignal)})}catch(e){if(e.status!==429||attempt===3||runSignal.aborted)throw e;
 const concurrency=kind==='jev'?pools.jev.reduce():kimiConcurrency;
 const waitMs=Math.max(retryDelayMs*2**(attempt-1),Math.min(e.retryAfterMs??0,30000));blockedUntil[kind]=Math.max(blockedUntil[kind],Date.now()+waitMs);
 (row.retryEvents??=[]).push({model:kind,attempt,status:429,waitMs});onEvent({type:'retry',id:row.id,model:kind,attempt,status:429,waitMs,concurrency});
 }}}
 function finish(row){rows.push(row);onEvent({type:'result',row:{...row}})}
 function failure(row,e){row.status='error';row.error=e?.message??'Run cancelled';row.failedCalls=[...(row.failedCalls??[]),e?.usage??{cost:null,costBasis:'unavailable'}];finish(row);if([401,402,403].includes(e?.status))controller.abort(Error('Provider authorization or balance failure'));}
 try{
 await Promise.all(emails.map(async email=>{if(runSignal.aborted)return;const row={...email};try{
 row.jev=await invoke('jev',row,jev);jevCount++;row.escalated=shouldEscalate(row.jev.confidence,threshold);
 onEvent({type:'jev',row:{...row}});
 if(!row.escalated){row.final=row.jev.choice;row.status='complete';finish(row);return;}
 onEvent({type:'stage',id:row.id,stage:'kimi-queued'});
 reviews.push((async()=>{if(runSignal.aborted){failure(row,runSignal.reason);return;}try{row.kimi=await invoke('kimi',row,kimi);row.final=row.kimi.choice;row.status='complete';finish(row)}catch(e){failure(row,e)}})());
 }catch(e){failure(row,e)}}));
 onEvent({type:'jev-complete',total:emails.length,classified:jevCount});
 await Promise.all(reviews);return rows;
 }finally{signal?.removeEventListener('abort',abort)}
}
