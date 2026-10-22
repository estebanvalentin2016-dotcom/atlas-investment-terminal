import {annualPeFromSec,defaultRankWeights,rankCompanies,assessEmergingFcfStrength,type AnnualPe,type MarketValuationClose,type SecCompany,type FcfStrengthAssessment} from './ranking-model';
import {initialAutonomousScreen,type ScreenResult} from './autonomous-screen';
import {writeSavedPasses} from './autonomous-pass-ledger';
import {flagIndicativeFyValuation} from './valuation-triage';
import {buildDiscoveryBriefing,type DiscoveryBriefingInput,type DiscoveryBriefingSnapshot} from './discovery-briefing-model';
import {writeDiscoveryBriefing} from './discovery-briefing-storage';
import {assessPriceHistory,combineResearchPriority,type HistoricalPriceResponse,type PriceHistoryAssessment} from './price-history-model';
import {appendIndustryComparabilityLimitations} from './industry-classification';
import {buildResearchHistoryRecords,createResearchHistoryRunId} from './research-history-model';
import {appendBrowserResearchHistory} from './research-history-storage';

export type Listed={ticker:string;name:string;cik:number};
export type UniversePage={total:number;start:number;nextCursor:number;completedCycle:boolean;rows:Listed[];indexUrl:string;retrievedAt:string;error?:string;seedTickersUsed:boolean;scope:string};
export type Candidate={company:SecCompany;screen:ScreenResult;valuation:AnnualPe|null;quote:MarketValuationClose|null;priceIssue:string|null;history:HistoricalPriceResponse|null;trend:PriceHistoryAssessment;historyIssue:string|null;priority:{score:number|null;priceWeighted:boolean}};
export type RecordEntry={company:SecCompany;screen:ScreenResult;emerging:FcfStrengthAssessment};
export const DISCOVERY_BATCH_SIZE=24;
const BATCH=DISCOVERY_BATCH_SIZE,CURSOR_KEY='atlas.autonomous.sec.cursor.v1';
const initialCursor=()=>{try{const n=Number(localStorage.getItem(CURSOR_KEY)||0);return Number.isSafeInteger(n)&&n>=0?n:0}catch{return 0}};
export const easternDate=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const x=Object.fromEntries(p.filter(k=>k.type!=='literal').map(k=>[k.type,k.value]));return x.year+'-'+x.month+'-'+x.day};

export type DiscoveryRunState={
 cursor:number;universe:UniversePage|null;batchCount:1|3;scannedBatches:number;
 allListed:Listed[];screened:ScreenResult[];failed:{ticker:string;reason:string}[];
 researchRecords:RecordEntry[];candidates:Candidate[];briefing:DiscoveryBriefingSnapshot|null;
 busy:boolean;error:string;progress:string;done:boolean;quotesChecked:number;
};
export type DiscoveryController=ReturnType<typeof createAutonomousDiscoveryController>;

// One controller is created by App; views subscribe without owning execution.
export function createAutonomousDiscoveryController(options?:{fetcher?:typeof fetch}){
 let state:DiscoveryRunState={
  cursor:initialCursor(),universe:null,batchCount:1,scannedBatches:0,allListed:[],screened:[],
  failed:[],researchRecords:[],candidates:[],briefing:null,busy:false,error:'',progress:'',done:false,quotesChecked:0
 };
 const listeners=new Set<()=>void>();
 const getSnapshot=()=>state;
 const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
 const update=(change:Partial<DiscoveryRunState>)=>{state={...state,...change};listeners.forEach(listener=>listener())};
 const setCursor=(cursor:number)=>update({cursor});
 const setUniverse=(universe:UniversePage|null)=>update({universe});
 const setScannedBatches=(scannedBatches:number)=>update({scannedBatches});
 const setAllListed=(allListed:Listed[])=>update({allListed});
 const setScreened=(screened:ScreenResult[])=>update({screened});
 const setFailed=(failed:{ticker:string;reason:string}[])=>update({failed});
 const setResearchRecords=(researchRecords:RecordEntry[])=>update({researchRecords});
 const setCandidates=(candidates:Candidate[])=>update({candidates});
 const setBriefing=(briefing:DiscoveryBriefingSnapshot|null)=>update({briefing});
 const setBusy=(busy:boolean)=>update({busy});
 const setError=(error:string)=>update({error});
 const setProgress=(progress:string)=>update({progress});
 const setDone=(done:boolean)=>update({done});
 const setQuotesChecked=(quotesChecked:number)=>update({quotesChecked});
 const request=(url:string)=>(options?.fetcher??fetch)(url);
 let activeRun:Promise<void>|null=null;
 const setBatchCount=(value:number)=>{if(!state.busy&&(value===1||value===3))update({batchCount:value})};
 const resetCursor=()=>{if(state.busy)return;setCursor(0);try{localStorage.setItem(CURSOR_KEY,'0')}catch{}setProgress('SEC index scan cursor reset. The next scan starts at index position 0.')};
 const start=()=>{
  if(activeRun)return activeRun;
  const {cursor,batchCount}=state;
  const pending=Promise.resolve().then(()=>run(cursor,batchCount));
  activeRun=pending;
  setBusy(true);
  void pending.then(()=>{activeRun=null},()=>{activeRun=null});
  return pending;
 };
 async function run(cursor:number,batchCount:number){
  update({done:false,universe:null,screened:[],candidates:[],failed:[],researchRecords:[],error:'',quotesChecked:0,scannedBatches:0,allListed:[]});
  setProgress('Enumerating actual companies from the SEC ticker index…');
  try{
   const today=easternDate(),records:RecordEntry[]=[],sourceIssues:{ticker:string;reason:string}[]=[];
   const listed:Listed[]=[];
   let firstPage:UniversePage|null=null,nextCursor=cursor,completed=0;
   // A single explicit scan can walk several consecutive SEC index batches.
   // Two company-fact requests at once; never send the entire universe at SEC.
   for(let batch=0;batch<batchCount;batch++){
    setProgress('Enumerating SEC company batch '+(batch+1)+' of '+batchCount+'…');
    const r=await request('/api/autonomous/universe?cursor='+nextCursor+'&limit='+BATCH);
    const page=await r.json() as UniversePage;
    if(!r.ok||!Array.isArray(page.rows)||!page.indexUrl?.startsWith('https://www.sec.gov/'))throw Error(page.error||'Cannot enumerate the public SEC company universe');
    if(!firstPage)firstPage=page;
    if(page.total!==firstPage.total)throw Error('SEC index changed size during this run; results withheld to avoid misleading scan counts');
    listed.push(...page.rows);
    for(let i=0;i<page.rows.length;i+=2){
     const group=page.rows.slice(i,i+2);
     await Promise.all(group.map(async ({ticker})=>{
       try{
        const response=await request('/api/sec/company?ticker='+encodeURIComponent(ticker));
        const company=await response.json() as SecCompany&{error?:string};
        if(!response.ok||!company.source?.startsWith('https://data.sec.gov/')||company.ticker!==ticker||!Array.isArray(company.metrics))throw Error(company.error||'SEC annual source incomplete');
        const screen=initialAutonomousScreen(company,today);
        const emerging = assessEmergingFcfStrength(company,today);
        records.push({company,screen,emerging});
       }catch(e){sourceIssues.push({ticker,reason:e instanceof Error?e.message:'SEC company facts unavailable'})}
      setProgress('Checked '+(records.length+sourceIssues.length)+' / '+(batchCount*BATCH)+' planned SEC companies · batch '+(batch+1)+' / '+batchCount);
     }));
    }
    nextCursor=page.nextCursor;completed++;
    setScannedBatches(completed);
    if(page.completedCycle)break;
   }
   if(!firstPage)throw Error('No SEC index batch was returned');
   setUniverse(firstPage);setAllListed(listed);
   const passes=records.filter(x=>x.screen.status==='preliminary_pass')
    .sort((a,b)=>(b.screen.score??-1)-(a.screen.score??-1)||a.company.ticker.localeCompare(b.company.ticker));
    setScreened(records.map(x=>x.screen));setFailed(sourceIssues);setResearchRecords(records);
   // Only the leading provisional passes receive price requests in this first
   // bounded scan. This must NEVER be interpreted as full market valuation coverage.
   const subset=passes.slice(0,8),research:Candidate[]=[];
   for(let i=0;i<subset.length;i++){
    const row=subset[i];setProgress('Checking completed IEX prices for '+row.company.ticker+' ('+(i+1)+' / '+subset.length+')');
    let quote:MarketValuationClose|null=null,valuation:AnnualPe|null=null,priceIssue:string|null=null;
    try{
     const response=await request('/api/market/valuation-close?ticker='+encodeURIComponent(row.company.ticker));
     const body=await response.json() as MarketValuationClose&{error?:string};
     if(!response.ok||body.ticker!==row.company.ticker||body.feed!=='IEX'||!body.completedSession)throw Error(body.error||'Completed IEX close not verified');
     quote=body;
     valuation=annualPeFromSec(row.company,body);
    }catch(e){priceIssue=e instanceof Error?e.message:'Completed-price data unavailable'}
    let history:HistoricalPriceResponse|null=null,historyIssue:string|null=null;
    try{
     const h=await request('/api/market/long-history?ticker='+encodeURIComponent(row.company.ticker));
     const body=await h.json() as HistoricalPriceResponse&{error?:string};
     if(!h.ok||body.ticker!==row.company.ticker||!Array.isArray(body.bars))throw Error(body.error||'Split-adjusted weekly prices unavailable');
     history=body;
    }catch(e){historyIssue=e instanceof Error?e.message:'Historical price source unavailable'}
    const trend=assessPriceHistory(history,today);
    research.push({...row,quote,valuation,priceIssue,history,trend,historyIssue,priority:{score:null,priceWeighted:false}});
    setQuotesChecked(i+1);
   }
   const valuationMap=Object.fromEntries(research.map(x=>[x.company.ticker,x.valuation?.pe??null]));
   const fundamental=rankCompanies(research.map(x=>x.company),defaultRankWeights,valuationMap,today);
   const fundamentals=new Map(fundamental.map(x=>[x.ticker,x.score]));
   const rankings=new Map(fundamental.map(x=>[x.ticker,x]));
   for(const item of research)item.priority=combineResearchPriority(fundamentals.get(item.company.ticker)??null,item.trend);
   // P/E cautions come first. A 20% stock-price trend is used only for
   // successfully fetched, dated, 1Y+3Y split-adjusted history in this small
   // top-eight research sample. Missing history never becomes a bullish signal.
   research.sort((a,b)=>flagIndicativeFyValuation(a.valuation).rank-flagIndicativeFyValuation(b.valuation).rank||
    (b.priority.score??-1)-(a.priority.score??-1)||
    (b.priority.priceWeighted?1:0)-(a.priority.priceWeighted?1:0)||
    a.company.ticker.localeCompare(b.company.ticker));
    setCandidates(research);
    const scanCompletedAt=new Date().toISOString();
    const runId=createResearchHistoryRunId(scanCompletedAt);
    const historyRecords=buildResearchHistoryRecords({
      completed:true,completedAt:scanCompletedAt,assessmentDate:today,runId,assessments:records,
      enrichments:research.map(item=>({ticker:item.company.ticker,valuation:item.valuation,quote:item.quote,ranking:rankings.get(item.company.ticker)??null,priceIssue:item.priceIssue,historyIssue:item.historyIssue}))
    });

    // Build discovery briefing from results
    const briefingInput: DiscoveryBriefingInput = {
      scanCompletedAt,
      issuersExamined: records.length,
      leads: research.map(item => {
        // Find the matching record for emerging strength
        const record = records.find(r => r.company.ticker === item.company.ticker);
        // Use only valid Emerging Strength statuses: improving, not_improving, insufficient_evidence
        let emergingStatus: 'improving' | 'not_improving' | 'insufficient_evidence' = 'insufficient_evidence';
        if (record) {
          emergingStatus = record.emerging.status;
        }
        return {
          ticker: item.company.ticker,
          companyName: item.company.name,
          preliminaryScreenStatus: item.screen.status,
          revenueGrowth: item.screen.growth,
          fcfMargin: item.screen.fcfMargin,
          annualPe: item.valuation?.pe ?? null,
          emergingStrength: emergingStatus,
          screeningReasons: item.screen.reasons,
          evidenceLimitations: appendIndustryComparabilityLimitations(
            item.priceIssue || item.historyIssue ? [item.priceIssue || '', item.historyIssue || ''].filter(Boolean) as string[] : null,
            item.company.classification
          )
        };
      })
    };

    const briefingSnapshot = buildDiscoveryBriefing(briefingInput);
    writeSavedPasses(passes.filter(x=>x.screen.score!==null&&x.screen.filed!==null).map(x=>({ticker:x.company.ticker,observedAt:today,annualFiled:x.screen.filed!,preliminaryScore:x.screen.score!})),today);
    setBriefing(briefingSnapshot);

    // Save briefing snapshot to localStorage
    try{writeDiscoveryBriefing(globalThis.localStorage, briefingSnapshot)}catch{}
    const historyResult=appendBrowserResearchHistory(historyRecords);
    const historyNote=historyResult.status==='saved'
      ?' Browser-local history saved '+historyResult.saved+' issuer assessment(s)'+(historyResult.dropped?' and evicted '+historyResult.dropped+' oldest record(s) under the 1,200-record retention cap.':'.')
      :' Browser-local assessment history was not saved ('+historyResult.status+'); the completed scan remains available in this session.';
    setProgress('Completed provisional SEC screening and price research. Price history is weighted at 20% only when comparable 1Y and 3Y observations exist; valuations remain unverified.'+historyNote);
    setDone(true);
    setCursor(nextCursor);
    try{localStorage.setItem(CURSOR_KEY,String(nextCursor))}catch{}
   }catch(e){
    setError(e instanceof Error?e.message:'Autonomous scan unavailable');
    setProgress('Scan failed. No companies were silently substituted.');
   }finally{setBusy(false)}
 }

 return {getSnapshot,subscribe,start,setBatchCount,resetCursor};
}

export const autonomousDiscoveryController=createAutonomousDiscoveryController();
