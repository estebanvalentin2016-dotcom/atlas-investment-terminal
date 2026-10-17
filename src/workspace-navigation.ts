export const workspaces = [
 {name:'Home',pages:['Research Home']},
 {name:'Discover',pages:['Autonomous Discovery','Opportunity Radar','Catalyst Radar','Institutional Discovery','Institutional Consensus','Breakthrough Radar','Discovery Feed']},
 {name:'Research',pages:['Company Research','Screener','SEC Research','Conviction Lab']},
 {name:'Watchlist',pages:['Watchlist']},
 {name:'Settings / Tools',pages:['Methodology','Daily Momentum','Momentum Scanner','Overview','Demo Screener','Valuation Lab','Demo Notes']}
] as const;
export type Workspace = typeof workspaces[number]['name'];
export type Page = typeof workspaces[number]['pages'][number];
export const workspaceFor = (page:Page) => workspaces.find(group=>(group.pages as readonly string[]).includes(page))!;
export const isDemoPage = (page:Page) => ['Overview','Demo Screener','Valuation Lab','Demo Notes'].includes(page);
export const pageLabel = (page:Page) => page==='Research Home'?'Home':page==='Overview'?'Demo Overview':page==='Screener'?'Financial Screener':page==='Valuation Lab'?'Demo Valuation Lab':page;
