const retired='That ChatGPT-hosted copy was removed. Open the local app at http://localhost:3017 and click Run Live there.';
export async function responseError(response){const text=await response.text();if(response.status===410||text.includes('This hosted copy has been removed'))return retired;try{const data=JSON.parse(text);if(typeof data.error==='string')return data.error;}catch{}return `The server returned HTTP ${response.status} instead of run data. Open the local app at http://localhost:3017 and try again.`;}
export async function consumeRun(response,onEvent){
 if(!response.ok)throw Error(await responseError(response));
 if(!response.headers.get('content-type')?.includes('application/x-ndjson'))throw Error(await responseError(response));
 if(!response.body)throw Error('The server returned no run stream. Try again.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',completed=false;
 const parse=line=>{if(!line.trim())return;let event;try{event=JSON.parse(line)}catch{throw Error('The run stream was interrupted or was not valid JSON. Completed decisions remain visible; try again.')}if(event.type==='error')throw Error(event.error??'Run interrupted');if(event.type==='done')completed=true;onEvent(event)};
 try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let newline;while((newline=buffer.indexOf('\n'))!==-1){parse(buffer.slice(0,newline));buffer=buffer.slice(newline+1)}}buffer+=decoder.decode();if(buffer.trim())parse(buffer);if(!completed)throw Error('The connection ended before the run finished. Completed decisions remain visible; try again.');}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock()}
}
