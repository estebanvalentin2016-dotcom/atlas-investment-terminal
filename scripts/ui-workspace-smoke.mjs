// Optional browser validation. Install Playwright outside the checkout; see UI_CONSOLIDATION.md.
// Fixtures exercise UI behavior only and are never substituted into the application runtime.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.ATLAS_PLAYWRIGHT_PATH?pathToFileURL(process.env.ATLAS_PLAYWRIGHT_PATH).href:'playwright');
const output=process.env.ATLAS_UI_ARTIFACTS||'/tmp/atlas-ui-artifacts';await mkdir(output,{recursive:true});
const base=process.env.ATLAS_UI_BASE||'http://127.0.0.1:5176';
const browser=await chromium.launch({executablePath:process.env.ATLAS_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const pages={Discover:['Autonomous Discovery','Opportunity Radar','Catalyst Radar','Institutional Discovery','Institutional Consensus','Breakthrough Radar','Discovery Feed'],Research:['Company Research','Financial Screener','SEC Research','Conviction Lab'],'Settings / Tools':['Methodology','Daily Momentum','Momentum Scanner','Demo Overview','Demo Screener','Demo Valuation Lab','Demo Notes']};
const source='https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json';
const year=new Date().getUTCFullYear();
const now=new Date().toISOString();const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
const watch=[{ticker:'TEST',name:'UI fixture company — not live data'},{ticker:'OTHER',name:'Second UI fixture company'}];
const sampleSummary={ticker:'TEST',createdAt:now,headline:'Evidence remains incomplete',finding:'UI fixture: annual source context requires further research.',action:'WATCH',source,verdict:'INSUFFICIENT EVIDENCE'};
const sampleThesis={ticker:'TEST',createdAt:new Date(Date.now()-86400000).toISOString(),thesis:'Original saved thesis',invalidation:'Counterevidence',verdict:'INSUFFICIENT EVIDENCE'};
const seed={'atlas.real.watch.v1':JSON.stringify(watch),'atlas.real.notes.v1':JSON.stringify({TEST:'Preserved existing note',OTHER:'Other note'}),'atlas.conviction.theses.v1':JSON.stringify([sampleThesis]),'atlas.research.summaries.v1':JSON.stringify([sampleSummary]),'atlas.notes':JSON.stringify({ASTR:'Legacy demo note'}),'atlas.watch':JSON.stringify(['ASTR']),'atlas.val':JSON.stringify({ASTR:{growth:25,margin:20,pe:30,years:5,dilution:1}}),'atlas.monthly.sec-ledger.v1':JSON.stringify([{ticker:'TEST',name:watch[0].name,filed:yesterday,form:'8-K',kind:'Unreviewed filing',url:'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001.txt'}])};
const apiRequests=[];const layoutErrors=[];const errors=[];let checks=0;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Chicago'});
 await context.addInitScript(values=>{for(const [key,value] of Object.entries(values))if(localStorage.getItem(key)===null)localStorage.setItem(key,value)},seed);
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url());apiRequests.push(url.pathname);
  if(url.pathname==='/api/sec/company'){
   const ticker=url.searchParams.get('ticker');const annual=value=>({year:year-1,end:`${year-1}-12-31`,filed:`${year}-02-15`,value,form:'10-K',accession:'0000000001-26-000001'});
   return route.fulfill({json:{ticker,name:'UI fixture company — not live data',source,retrievedAt:now,metrics:[{name:'Revenue',values:[annual(100)]},{name:'Net income',values:[annual(10)]},{name:'Operating cash flow',values:[annual(15)]},{name:'Capital expenditures',values:[annual(3)]}]}});
  }
  if(url.pathname==='/api/sec/search')return route.fulfill({json:{items:[{ticker:'ADDED',name:'New UI fixture company'}]}});
  return route.fulfill({status:503,json:{error:'UI validation fixture: provider intentionally unavailable'}});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await page.locator('h1').waitFor();
 const primary=page.getByRole('navigation',{name:'ATLAS workspace',exact:true});
 async function workspace(name){const menu=page.getByRole('button',{name:'Open navigation',exact:true});if(await menu.isVisible())await menu.click();await primary.getByRole('button',{name,exact:true}).click()}
 async function tool(group,name){await workspace(group);const secondary=page.getByRole('navigation',{name:group+' tools',exact:true});if(name.startsWith('Demo')&&!(await secondary.getByRole('button',{name,exact:true}).isVisible()))await secondary.getByText('Demo Sandbox · fictional data',{exact:true}).click();await secondary.getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('h1').textContent(),name);checks++}
 async function fits(label){const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));if(size.scroll>size.width+1)layoutErrors.push(`${label} overflow ${JSON.stringify(size)}`);checks++}
 async function shot(name){await page.mouse.move(5,5);await page.screenshot({path:`${output}/${name}.png`,fullPage:true})}
 assert.deepEqual(await primary.getByRole('button').allTextContents(),['Home','Discover','Research','Watchlist','Settings / Tools']);checks++;
 await shot('home-desktop');
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const [group,tools] of Object.entries(pages))for(const name of tools){await tool(group,name);await fits(`${width} ${name}`)}
  await workspace('Watchlist');await fits(`${width} Watchlist`);
  if(width===1440)await shot('watchlist-desktop');if(width===390)await shot('watchlist-mobile');
 }
 console.log('Layout checks:',JSON.stringify(layoutErrors));assert.deepEqual(layoutErrors,[]);
 await page.setViewportSize({width:1440,height:1000});
 await tool('Discover','Discovery Feed');await page.getByText('Academic publications · Crossref',{exact:true}).click();await page.getByRole('button',{name:'Find publications',exact:true}).waitFor();checks++;
 await workspace('Watchlist');const card=page.locator('.watchlist-card').filter({has:page.getByRole('heading',{name:'TEST',exact:true})});
 await card.getByRole('textbox').fill('Edited research note');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('atlas.real.notes.v1')).TEST),'Edited research note');checks++;
 assert(await card.textContent().then(text=>text.includes('Evidence remains incomplete')));await card.getByText('Saved filing developments (1)').click();assert.equal(await card.locator('.watchlist-developments a').getAttribute('href'),'https://www.sec.gov/Archives/edgar/data/1/0000000001-26-000001.txt');checks++;
 await page.getByRole('button',{name:'Select for comparison',exact:true}).nth(0).click();await page.getByRole('button',{name:'Select for comparison',exact:true}).click();await page.getByRole('button',{name:'Compare saved companies',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Company 1 ticker'}).inputValue(),'TEST');assert.equal(await page.getByRole('textbox',{name:'Company 2 ticker'}).inputValue(),'OTHER');checks++;
 await page.getByRole('button',{name:'Compare companies',exact:true}).click();await page.getByRole('columnheader').filter({hasText:'(OTHER)'}).waitFor();checks++;
 await card.getByRole('button',{name:'Research company →',exact:true}).click();await page.getByText('Your investment thesis · TEST',{exact:true}).waitFor();assert.equal(await page.locator('.atlas-research-note textarea').inputValue(),'Edited research note');checks++;
 await workspace('Watchlist');await card.getByRole('button',{name:'Evaluate conviction →',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Conviction research ticker'}).inputValue(),'TEST');
 await page.getByRole('button',{name:'Examine investment evidence',exact:true}).click();await page.getByText('What ATLAS found',{exact:true}).waitFor();assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('atlas.research.summaries.v1')).length>=2));checks++;
 await workspace('Watchlist');await card.getByRole('button',{name:'Remove TEST from watchlist',exact:true}).click();assert.equal(await card.count(),0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('atlas.real.notes.v1')).TEST),'Edited research note');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('atlas.conviction.theses.v1'))[0].thesis),'Original saved thesis');checks++;
 await page.getByRole('textbox',{name:'Search real company'}).fill('ADDED');await page.getByRole('button',{name:'Search companies',exact:true}).click();await page.getByRole('button',{name:'Save +',exact:true}).click();assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('atlas.real.watch.v1')).some(x=>x.ticker==='ADDED')));checks++;
 await page.reload();await workspace('Watchlist');assert.equal(await page.locator('.watchlist-card').count(),2);checks++;
 await tool('Settings / Tools','Demo Notes');assert.equal(await page.locator('.watchlist-card').filter({hasText:'ASTR ·'}).getByRole('textbox').inputValue(),'Legacy demo note');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('atlas.val')).ASTR.growth),25);checks++;
 await page.setViewportSize({width:390,height:844});await workspace('Home');await shot('home-mobile');await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Open navigation',exact:true}).getAttribute('aria-expanded'),'false');await page.waitForFunction(()=>document.activeElement?.id==='workspace-menu');checks++;
 await tool('Discover','Opportunity Radar');await shot('discover-mobile');await page.setViewportSize({width:1440,height:1000});await tool('Research','Company Research');await shot('research-desktop');
 // An unseeded browser must show truthful empty states without making provider requests from Watchlist.
 const fresh=await browser.newContext();const empty=await fresh.newPage();await fresh.route('**/api/**',route=>route.fulfill({status:503,json:{error:'UI fixture: source unavailable'}}));await empty.goto(base);await empty.getByRole('navigation',{name:'ATLAS workspace',exact:true}).getByRole('button',{name:'Watchlist',exact:true}).click();await empty.getByText('No real companies saved yet.',{exact:true}).waitFor();checks++;
 assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({checks,viewports:[1440,768,390,320],runtimeErrors:errors,fixtures:true,screenshots:output,apiPathsExercised:[...new Set(apiRequests)]},null,2));
}finally{await browser.close()}
