import {useState} from 'react';
import {ArrowDownRight, ArrowRight, ArrowUpRight, Asterisk, BookOpen, Check, CircleAlert, Clock3, ExternalLink, FileText, Layers3} from 'lucide-react';
import './company-research-prototype.css';

type View='illustration'|'empty';
type HistoryView='example'|'none';
type EvidenceRow={label:string;value:string;period:string;source:string;note:string;status?:'unavailable'};

const evidence:EvidenceRow[]=[
  {label:'Revenue',value:'$4.80B',period:'FY 2025 · USD',source:'Illustrative filing fixture · line 01',note:'Sample reported amount; no SEC filing was retrieved.'},
  {label:'Revenue growth',value:'+11.8%',period:'FY 2025 vs FY 2024',source:'ATLAS-style illustrative calculation',note:'Derived from two fictional annual revenue values.'},
  {label:'Operating cash flow',value:'$620M',period:'FY 2025 · USD',source:'Illustrative filing fixture · line 02',note:'Sample reported amount; scope has not been verified.'},
  {label:'Capital expenditure',value:'Unavailable',period:'FY 2025',source:'No reconciled fixture line',note:'A missing value is not zero; no FCF or FCF margin is shown.',status:'unavailable'},
];

function Eyebrow({children}:{children:React.ReactNode}){return <span className="crp-eyebrow">{children}</span>}

export default function CompanyResearchPrototype({initialView='illustration',initialHistoryView='example'}:{initialView?:View;initialHistoryView?:HistoryView}){
  const [view,setView]=useState<View>(initialView);
  const [historyView,setHistoryView]=useState<HistoryView>(initialHistoryView);
  return <div className="crp-page">
    <a className="crp-skip" href="#crp-main">Skip to research study</a>
    <div className="crp-frame">
      <header className="crp-masthead">
        <a className="crp-brand" href="/" aria-label="Return to production ATLAS Home"><span className="crp-mark"><Asterisk size={20} aria-hidden="true"/></span><span>ATLAS</span></a>
        <nav aria-label="Prototype sections" className="crp-nav"><a href="#crp-cases">Perspectives</a><a href="#crp-evidence">Evidence</a><a href="#crp-continuity">Continuity</a></nav>
        <span className="crp-masthead-label">DESIGN STUDY / NOT LIVE RESEARCH</span>
      </header>

      <main id="crp-main">
        <div className="crp-study-bar"><span><span className="crp-status-dot"/> Obsidian Glass · Company Research</span><span>Illustrative interface only</span></div>
        <div className="crp-view-switch" role="group" aria-label="Prototype record state">
          <button type="button" aria-pressed={view==='illustration'} onClick={()=>setView('illustration')}>Illustrative company</button>
          <button type="button" aria-pressed={view==='empty'} onClick={()=>setView('empty')}>No company selected</button>
        </div>

        {view==='empty'?<section className="crp-empty" aria-label="No company selected">
          <Eyebrow>COMPANY INTELLIGENCE / EMPTY STATE</Eyebrow>
          <h1>Start with a question.<br/><em>Then find the evidence.</em></h1>
          <p>No company has been selected in this design study. The search, SEC lookup, saved reasoning, and financial calculations remain in the production Company Research workflow; they are not connected to this page.</p>
          <a href="/" className="crp-link">Return to ATLAS <ArrowRight size={17} aria-hidden="true"/></a>
        </section>:<>
          <section className="crp-hero" aria-labelledby="crp-title">
            <div className="crp-hero-top">
              <div>
                <Eyebrow>COMPANY INTELLIGENCE / FICTIONAL DESIGN EXAMPLE</Eyebrow>
                <p className="crp-company-id">MERIDIAN FIELDWORKS <span>·</span> DEMO ISSUER</p>
                <h1 id="crp-title">A clearer investment<br/><em>perspective.</em></h1>
                <p className="crp-hero-deck">Can durable demand become durable cash generation? Examine the opportunity, challenge the assumptions, and see what evidence is still missing.</p>
              </div>
              <aside className="crp-posture" aria-label="Research status"><span>RESEARCH POSTURE</span><strong>Open question</strong><p>No buy rating, price target, or verified conviction is produced in this prototype.</p></aside>
            </div>
            <div id="crp-cases" className="crp-case-pair" aria-label="Balanced illustrative investment cases">
              <article className="crp-case crp-bull"><span className="crp-case-symbol"><ArrowUpRight size={19} aria-hidden="true"/></span><div><Eyebrow>BULL CASE · ILLUSTRATIVE HYPOTHESIS</Eyebrow><h2>What supports the opportunity?</h2><p>If repeat orders persist and working capital remains controlled, growing sales could translate into stronger owner cash flows.</p><small>Requires customer, margin, and cash-flow evidence. No conclusion established.</small></div></article>
              <article className="crp-case crp-bear"><span className="crp-case-symbol"><ArrowDownRight size={19} aria-hidden="true"/></span><div><Eyebrow>BEAR CASE · ILLUSTRATIVE HYPOTHESIS</Eyebrow><h2>What challenges the opportunity?</h2><p>Capacity spending, customer concentration, or weaker demand could absorb cash even while reported revenue rises.</p><small>These are research questions, not verified company-specific risks.</small></div></article>
            </div>
          </section>

          <div className="crp-section-index" aria-hidden="true"><span>01 / REPORTED EVIDENCE</span><span>02 / CONTEXT</span><span>03 / CONTINUITY</span></div>

          <section id="crp-evidence" className="crp-evidence crp-section" aria-labelledby="crp-evidence-heading">
            <div className="crp-section-heading"><div><Eyebrow>01 / FINANCIAL EVIDENCE</Eyebrow><h2 id="crp-evidence-heading">Begin with what is reported.<br/><em>Show what is not.</em></h2></div><p>All amounts below are invented layout fixtures. They are not SEC facts, live company data, or investment findings.</p></div>
            <div className="crp-evidence-head" aria-hidden="true"><span>MEASURE</span><span>VALUE / PERIOD</span><span>SOURCE AND BOUNDARY</span></div>
            <div className="crp-evidence-list">{evidence.map(row=><div className="crp-evidence-row" key={row.label}>
              <div className="crp-evidence-label"><span>{row.label}</span><small>{row.status==='unavailable'?'Reconciliation required':'Illustrative evidence'}</small></div>
              <div className="crp-evidence-number"><strong className={row.status==='unavailable'?'crp-value-unavailable':''}>{row.value}</strong><small>{row.period}</small></div>
              <div className="crp-evidence-source"><strong>{row.source}</strong><p>{row.note}</p></div>
            </div>)}</div>
            <p className="crp-evidence-boundary"><CircleAlert size={17} aria-hidden="true"/><span><strong>Source boundary.</strong> This design page has no SEC connection. A production record should link each reported fact to its filing, accession, period, unit, and retrieval date before ATLAS derives a comparison.</span></p>
          </section>

          <section className="crp-context crp-section" aria-labelledby="crp-context-heading">
            <div className="crp-section-heading"><div><Eyebrow>02 / MACROECONOMIC CONTEXT</Eyebrow><h2 id="crp-context-heading">A catalyst is not<br/><em>an explanation.</em></h2></div><p>Publication, relevance, and company impact are separate evidence questions. This prototype performs no macro ingestion or event matching.</p></div>
            <div className="crp-macro-grid">
              <div className="crp-macro-intro"><span className="crp-macro-icon"><Layers3 size={22} aria-hidden="true"/></span><h3>What could change the case?</h3><p>Context belongs beside the thesis only when its source date and company linkage can be explained.</p></div>
              <div className="crp-macro-ledger" aria-label="Macroeconomic assessment states">
                <div><span>CPI</span><strong>Unassessed</strong><p>No dated inflation release has been linked to this illustrative company.</p></div>
                <div><span>FOMC</span><strong>Unassessed</strong><p>No rate decision or company-specific sensitivity has been evaluated.</p></div>
                <div><span>Employment</span><strong>Unavailable</strong><p>No employment-series source is connected to this prototype.</p></div>
              </div>
            </div>
            <p className="crp-assessment-note"><Check size={17} aria-hidden="true"/><span><strong>Assessed state, when supported:</strong> show an exact release, publication time, source, analyst rationale, and explicit uncertainty. None is asserted here.</span></p>
          </section>

          <section id="crp-continuity" className="crp-continuity crp-section" aria-labelledby="crp-continuity-heading">
            <div className="crp-section-heading"><div><Eyebrow>03 / INVESTOR REASONING</Eyebrow><h2 id="crp-continuity-heading">Follow the thesis.<br/><em>Not just the ticker.</em></h2></div><p>Investor-authored reasoning is distinct from ATLAS screening. This page demonstrates the layout; it does not read or write saved research.</p></div>
            <div className="crp-thesis-layout">
              <article className="crp-thesis"><div className="crp-thesis-top"><BookOpen size={19} aria-hidden="true"/><span>ILLUSTRATIVE SAVED THESIS</span></div><h3>Growth is useful only if the cash follows.</h3><p>The investor’s working case depends on recurring orders, stable unit economics, and a reconciled cash-investment requirement. No assumption is treated as verified by this design sample.</p><div className="crp-assumptions"><span>Assumptions to revisit</span><ul><li>Repeat demand remains durable</li><li>Spending converts into productive capacity</li><li>Cash generation survives the investment cycle</li></ul></div><small>Example of user-authored notes · not actually saved</small></article>
              <article className="crp-history" aria-labelledby="crp-history-heading"><div className="crp-history-head"><div><Clock3 size={19} aria-hidden="true"/><span>THESIS HISTORY</span></div><div className="crp-history-switch" role="group" aria-label="History state"><button type="button" aria-pressed={historyView==='example'} onClick={()=>setHistoryView('example')}>Example</button><button type="button" aria-pressed={historyView==='none'} onClick={()=>setHistoryView('none')}>No history</button></div></div><h3 id="crp-history-heading">What changed since the last assessment?</h3>
                {historyView==='example'?<div className="crp-timeline"><div><span>ILLUSTRATIVE · 02 SEP 2026</span><strong>Initial investor hypothesis recorded</strong><p>Demand durability was the question; cash-spending scope remained unresolved.</p></div><div><span>ILLUSTRATIVE · 17 OCT 2026</span><strong>Investor revised the uncertainty</strong><p>The example thesis places more weight on cash-investment reconciliation. This is a fictional manual revision, not an automatic alert.</p></div></div>:<div className="crp-no-history"><FileText size={24} aria-hidden="true"/><strong>No prior assessment is available.</strong><p>Do not imply a company was flagged earlier or that its thesis changed. A first saved assessment would establish the starting point.</p></div>}
                <p className="crp-history-boundary">No background monitoring, automatic reassessment, or historical proof is connected to this prototype.</p>
              </article>
            </div>
          </section>

          <footer className="crp-footer"><div><Eyebrow>SOURCE REGISTER / DESIGN BOUNDARY</Eyebrow><p><strong>No live source documents were used.</strong> Figures, company, thesis, and chronology are fictional. In production, original filings and macro releases must be linked before an interpretation is presented as evidence.</p></div><a href="/" className="crp-link">Return to production ATLAS <ExternalLink size={16} aria-hidden="true"/></a></footer>
        </>}
      </main>
    </div>
    <div className="crp-bottom-rail" aria-label="Prototype mobile navigation"><a href="#crp-main"><span>Research</span></a><a href="#crp-cases"><span>Cases</span></a><a href="#crp-evidence"><span>Evidence</span></a><a href="#crp-continuity"><span>Continuity</span></a></div>
  </div>;
}
