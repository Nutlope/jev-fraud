import emails from '@/data/emails.json';
import {summarize} from '@/lib/pipeline.mjs';
import {runBatch,CONCURRENCY} from '@/lib/batch.mjs';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(request:Request){
 if(process.env.NODE_ENV==='production'&&process.env.ENABLE_LIVE_RUNS!=='true')return Response.json({error:'Live inference is disabled on this deployment. Configure access protection and ENABLE_LIVE_RUNS=true to enable it.'},{status:403});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origin not allowed'},{status:403});
 let body:{threshold?:unknown};try{body=await request.json();if(!body||typeof body!=='object')throw Error()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const threshold=body.threshold??.95;if(typeof threshold!=='number'||!Number.isFinite(threshold)||threshold<.5||threshold>1)return Response.json({error:'Threshold must be 50–100%'},{status:400});
 if(!process.env.AI_GATEWAY_API_KEY||!process.env.TOGETHER_API_KEY)return Response.json({error:'Live mode needs AI_GATEWAY_API_KEY and TOGETHER_API_KEY on the server.'},{status:503});
 const encoder=new TextEncoder(),abort=new AbortController();const cancel=()=>abort.abort();request.signal.addEventListener('abort',cancel,{once:true});if(request.signal.aborted)cancel();
 const stream=new ReadableStream({async start(controller){
 const send=(event:unknown)=>{if(!abort.signal.aborted)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'))};
 send({type:'start',threshold,total:emails.length,concurrency:CONCURRENCY,startedAt:new Date().toISOString()});
 try{const rows=await runBatch(emails,process.env,{threshold,onEvent:send,signal:abort.signal});send({type:'done',rows,summary:summarize(rows),threshold,finishedAt:new Date().toISOString()});}
 catch{send({type:'error',error:'Run interrupted. Completed decisions remain visible; try again.'});}
 finally{request.signal.removeEventListener('abort',cancel);if(!abort.signal.aborted)controller.close();}
 },cancel});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store, no-transform','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'}});
}
