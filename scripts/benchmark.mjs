import fs from 'node:fs';import {parseEnv} from 'node:util';
if(fs.existsSync('.env.local'))Object.assign(process.env,parseEnv(fs.readFileSync('.env.local','utf8')));
await import('./run-benchmark.mjs');
