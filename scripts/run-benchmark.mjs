import fs from 'node:fs/promises';
import {processEmail,summarize,THRESHOLD,MODELS,PRICES} from '../lib/pipeline.mjs';
const emails=JSON.parse(await fs.readFile(new URL('../data/emails.json',import.meta.url),'utf8'));
const output=new URL('../data/recording.json',import.meta.url);const startedAt=new Date().toISOString(),start=Date.now(),rows=[],events=[];let index=0,stop=false;
const record=event=>events.push({...event,at:Date.now()-start});
const save=()=>fs.writeFile(output,JSON.stringify({status:rows.length===100?'complete':'partial',startedAt,finishedAt:new Date().toISOString(),durationMs:Date.now()-start,threshold:THRESHOLD,models:MODELS,prices:PRICES,rows:[...rows].sort((a,b)=>a.id.localeCompare(b.id)),events,summary:summarize(rows)},null,2));
await Promise.all(Array.from({length:5},async()=>{while(index<emails.length&&!stop){const row=await processEmail(emails[index++],process.env,THRESHOLD,record);rows.push(row);console.log(`${rows.length}/100 ${row.id} ${row.jev?.choice??'error'} ${row.jev?.confidence?.toFixed(3)??''} ${row.escalated?'→ Kimi':''} ${row.final??row.error}`);if(row.error&&!row.jev)stop=true;}}));await save();console.log(JSON.stringify(summarize(rows),null,2));
