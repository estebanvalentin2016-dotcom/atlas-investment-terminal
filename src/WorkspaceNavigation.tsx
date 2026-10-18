import {workspaces,workspaceFor,isDemoPage,pageLabel,type Page} from './workspace-navigation';
export function PrimaryNavigation({page,navigate}:{page:Page;navigate:(page:Page)=>void}){
 const current=workspaceFor(page);
 return <nav aria-label="ATLAS workspace">{workspaces.map(group=><button type="button" key={group.name} className={'navitem '+(group.name===current.name?'active':'')} aria-current={group.name===current.name?'page':undefined} onClick={()=>navigate(group.name===current.name?page:group.pages[0])}><span>{group.name}</span></button>)}</nav>;
}
export function SecondaryNavigation({page,navigate}:{page:Page;navigate:(page:Page)=>void}){
 const current=workspaceFor(page);
 if(current.pages.length===1)return null;
 const regular=current.pages.filter(p=>!isDemoPage(p));
 const demo=current.pages.filter(isDemoPage);
 const link=(p:Page)=><button type="button" key={p} aria-current={p===page?'page':undefined} onClick={()=>navigate(p)}>{pageLabel(p)}</button>;
 return <nav className="workspace-secondary" aria-label={current.name+' tools'}><div className="workspace-tool-links">{regular.map(link)}</div>{demo.length>0&&<details className="workspace-demo-tools" open={isDemoPage(page)||undefined}><summary>Demo Sandbox · fictional data</summary><div className="workspace-tool-links">{demo.map(link)}</div></details>}</nav>;
}
