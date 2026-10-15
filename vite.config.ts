import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type {Plugin} from 'vite';
// @ts-ignore JavaScript-only server module; runs in Node, never in browser.

import {handleSecRequest} from './server/sec-api.mjs';
// @ts-ignore JavaScript-only Node middleware.
import {handleDiscoveryRequest} from './server/discovery-api.mjs';
// @ts-ignore JavaScript-only Node middleware.
import {handleCatalystRequest} from './server/catalyst-api.mjs';
// @ts-ignore JavaScript-only Node middleware.
import {handleMarketRequest,handleValuationPriceRequest} from './server/market-api.mjs';
// @ts-ignore Node middleware module
import {handleIntradayRequest} from './server/intraday-api.mjs';
// @ts-ignore Node-only news discovery adapter
import {handleAnnouncementRequest} from './server/announcement-api.mjs';
// @ts-ignore server-only public keyword RSS adapter
import {handleTopicNewsRequest} from './server/topic-news-api.mjs';
// @ts-ignore Node-only overnight research adapter
import {handleOvernightRequest} from './server/overnight-api.mjs';
// @ts-ignore server-only public SEC index discovery
import {handleWideDiscovery} from './server/opportunity-wide-api.mjs';
// @ts-ignore Node-only SEC disclosure evidence review
import {handleFilingReview} from './server/filing-review-api.mjs';
// @ts-ignore Node-only SEC SGML acceptance clock adapter
import {handleFilingAcceptanceRequest} from './server/filing-acceptance-api.mjs';
// @ts-ignore Node-only SEC 13F reporting-manager pipeline
import {handleInstitutionalRequest} from './server/institutional-api.mjs';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 process.env.SEC_USER_AGENT=env.SEC_USER_AGENT||process.env.SEC_USER_AGENT;
 process.env.ALPACA_API_KEY_ID=env.ALPACA_API_KEY_ID||process.env.ALPACA_API_KEY_ID;
 process.env.ALPACA_API_SECRET_KEY=env.ALPACA_API_SECRET_KEY||process.env.ALPACA_API_SECRET_KEY;
 const secPlugin:Plugin={name:'atlas-sec-proxy',configureServer(server){server.middlewares.use((req,res,next)=>{Promise.resolve(handleSecRequest(req,res)).then(handled=>handled?true:handleDiscoveryRequest(req,res)).then(handled=>handled?true:handleCatalystRequest(req,res)).then(handled=>handled?true:handleMarketRequest(req,res)).then(handled=>handled?true:handleValuationPriceRequest(req,res)).then(handled=>handled?true:handleIntradayRequest(req,res)).then(handled=>handled?true:handleAnnouncementRequest(req,res)).then(handled=>handled?true:handleTopicNewsRequest(req,res)).then(handled=>handled?true:handleOvernightRequest(req,res)).then(handled=>handled?true:handleWideDiscovery(req,res)).then(handled=>handled?true:handleFilingReview(req,res)).then(handled=>handled?true:handleFilingAcceptanceRequest(req,res)).then(handled=>handled?true:handleInstitutionalRequest(req,res)).then(handled=>{if(!handled)next()}).catch(next)})},configurePreviewServer(server){server.middlewares.use((req,res,next)=>{Promise.resolve(handleSecRequest(req,res)).then(handled=>handled?true:handleDiscoveryRequest(req,res)).then(handled=>handled?true:handleCatalystRequest(req,res)).then(handled=>handled?true:handleMarketRequest(req,res)).then(handled=>handled?true:handleValuationPriceRequest(req,res)).then(handled=>handled?true:handleIntradayRequest(req,res)).then(handled=>handled?true:handleAnnouncementRequest(req,res)).then(handled=>handled?true:handleTopicNewsRequest(req,res)).then(handled=>handled?true:handleOvernightRequest(req,res)).then(handled=>handled?true:handleWideDiscovery(req,res)).then(handled=>handled?true:handleFilingReview(req,res)).then(handled=>handled?true:handleFilingAcceptanceRequest(req,res)).then(handled=>handled?true:handleInstitutionalRequest(req,res)).then(handled=>{if(!handled)next()}).catch(next)})}};
 return {plugins:[react(),secPlugin],test:{environment:'node'}};
});
