import fs from 'node:fs/promises';
import {runBatch,CONCURRENCY} from '../lib/batch.mjs';
import {summarize,THRESHOLD,MODELS,PRICES} from '../lib/pipeline.mjs';
const emails=JSON.parse(await fs.readFile(new URL('../data/emails.json',import.meta.url),'utf8'));
const output=new URL('../data/recording.json',import.meta.url);const startedAt=new Date().toISOString(),start=Date.now(),rows=[],events=[];
const record=event=>events.push({...event,at:Date.now()-start});
const save=()=>fs.writeFile(output,JSON.stringify({status:rows.length===100?'complete':'partial',startedAt,finishedAt:new Date().toISOString(),durationMs:Date.now()-start,threshold:THRESHOLD,concurrency:CONCURRENCY,providers:{jev:"Vercel AI Gateway",kimi:"Together AI"},models:MODELS,prices:PRICES,rows:[...rows].sort((a,b)=>a.id.localeCompare(b.id)),events,summary:summarize(rows)},null,2));
rows.push(...await runBatch(emails,process.env,{threshold:THRESHOLD,onEvent:event=>{record(event);if(event.type==='result')console.log(`${event.row.id} ${event.row.final??event.row.error}`)}}));await save();console.log(JSON.stringify(summarize(rows),null,2));
