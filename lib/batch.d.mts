export const CONCURRENCY:{jev:number;kimi:number};
export function runBatch(emails:any[],env:any,options?:{threshold?:number;onEvent?:(event:any)=>void;signal?:AbortSignal;jevConcurrency?:number;kimiConcurrency?:number;jev?:Function;kimi?:Function;retryDelayMs?:number}):Promise<any[]>;
