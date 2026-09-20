export function responseError(response:Response):Promise<string>;
export function consumeRun(response:Response,onEvent:(event:any)=>void):Promise<void>;
