import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {createRequire} from 'node:module';
if(fs.existsSync('.env.local'))Object.assign(process.env,parseEnv(fs.readFileSync('.env.local','utf8')));
const require=createRequire(import.meta.url);
const cli=require.resolve('next/dist/bin/next');
process.argv=[process.execPath,cli,...process.argv.slice(2)];
await import(cli);
