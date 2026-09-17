export const runtime = 'nodejs';
export const maxDuration = 300;
import emails from '@/data/emails.json';
import { processEmail, summarize } from '@/lib/pipeline.mjs';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origin not allowed'},{status:403});
 let body:{threshold?:unknown};try{body=await request.json() as {threshold?:unknown};if(!body||typeof body!=='object')throw Error()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const threshold=body.threshold??0.95;if(typeof threshold!=='number'||!Number.isFinite(threshold)||threshold<0.5||threshold>1)return Response.json({error:'Threshold must be 50–100%'},{status:400});
 if(!process.env.AI_GATEWAY_API_KEY||!process.env.OPENROUTER_API_KEY)return Response.json({error:'Live mode needs AI_GATEWAY_API_KEY and OPENROUTER_API_KEY on the server. Recorded results can still be replayed.'},{status:503});
 const encoder=new TextEncoder();const abort=new AbortController();request.signal.addEventListener('abort',()=>abort.abort(),{once:true});
 const stream=new ReadableStream({async start(controller){const rows:any[]=[];let index=0;const send=(event:unknown)=>{if(!abort.signal.aborted)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'))};
 send({type:'start',threshold,total:emails.length,startedAt:new Date().toISOString()});
 try{await Promise.all(Array.from({length:5},async()=>{while(index<emails.length&&!abort.signal.aborted){const email=emails[index++];const row=await processEmail(email,process.env,threshold,send,abort.signal);rows.push(row);if(row.error&&!row.jev){abort.abort();break;}}}));if(!request.signal.aborted){controller.enqueue(encoder.encode(JSON.stringify({type:'done',rows,summary:summarize(rows),threshold,finishedAt:new Date().toISOString()})+'\n'));controller.close();}}catch{if(!request.signal.aborted)controller.error(Error('Run interrupted'));}},cancel(){abort.abort();}});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
