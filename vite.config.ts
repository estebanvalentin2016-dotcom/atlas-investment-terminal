import { defineConfig, loadEnv } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type {Plugin} from 'vite';
// @ts-ignore JavaScript-only server module; runs in Node, never in browser.

import {handleSecRequest} from './server/sec-api.mjs';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'SEC_');
 process.env.SEC_USER_AGENT=env.SEC_USER_AGENT||process.env.SEC_USER_AGENT;
 const secPlugin:Plugin={name:'atlas-sec-proxy',configureServer(server){server.middlewares.use((req,res,next)=>{Promise.resolve(handleSecRequest(req,res)).then(handled=>{if(!handled)next()}).catch(next)})},configurePreviewServer(server){server.middlewares.use((req,res,next)=>{Promise.resolve(handleSecRequest(req,res)).then(handled=>{if(!handled)next()}).catch(next)})}};
 return {plugins:[react(),secPlugin],test:{environment:'node'}};
});
