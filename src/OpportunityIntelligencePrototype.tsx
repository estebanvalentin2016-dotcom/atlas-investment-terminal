import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Asterisk,
  Check,
  CircleAlert,
  Clock3,
  ShieldCheck,
} from 'lucide-react';
import './opportunity-intelligence-prototype.css';

const peers = [
  {
    ticker: 'NOVA',
    name: 'Nova Relay Works',
    signal: 'Secondary beneficiary',
    direction: 'positive',
    note: 'Promising backlog, but customer concentration leaves the catalyst less diversified.',
  },
  {
    ticker: 'MTRX',
    name: 'Matrix Power Systems',
    signal: 'Watch, not priority',
    direction: 'neutral',
    note: 'Direct exposure is credible; current evidence does not establish improving cash conversion.',
  },
  {
    ticker: 'VOLT',
    name: 'Voltane Infrastructure',
    signal: 'Insufficient evidence',
    direction: 'negative',
    note: 'The thematic fit is clear, but leverage and project timing remain unresolved.',
  },
] as const;

function SignalChart() {
  return <figure className="oi-signal" aria-labelledby="oi-signal-title">
    <figcaption>
      <span id="oi-signal-title">Research signal progression</span>
      <span>Illustrative score · not a forecast</span>
    </figcaption>
    <div className="oi-chart" role="img" aria-label="Illustrative research signal rises from 42 before the catalyst to 73 after the catalyst, while the verification threshold remains at 80">
      <svg viewBox="0 0 720 190" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="oi-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#729b80" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#729b80" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="oi-gridline" d="M0 46H720 M0 101H720 M0 156H720" />
        <path className="oi-threshold" d="M0 40H720" />
        <path className="oi-area" d="M0 158 C95 151 120 143 185 139 S292 132 350 123 S448 83 535 73 S650 61 720 53 V190 H0Z" />
        <path className="oi-line" d="M0 158 C95 151 120 143 185 139 S292 132 350 123 S448 83 535 73 S650 61 720 53" />
        <circle className="oi-point oi-point-before" cx="350" cy="123" r="5" />
        <circle className="oi-point oi-point-after" cx="720" cy="53" r="6" />
      </svg>
      <span className="oi-chart-threshold">Verification threshold</span>
      <span className="oi-chart-before">Before catalyst <b>42</b></span>
      <span className="oi-chart-after">Current <b>73</b></span>
    </div>
  </figure>;
}

export default function OpportunityIntelligencePrototype() {
  return <div className="oi-prototype">
    <a className="oi-skip" href="#priority-research">Skip to priority research</a>

    <header className="oi-masthead">
      <a className="oi-wordmark" href="/" aria-label="Return to ATLAS Research Terminal">
        <span className="oi-mark" aria-hidden="true"><Asterisk size={18} /></span>
        <span>ATLAS</span>
      </a>
      <div className="oi-context" aria-label="Prototype context">
        <span>Opportunity Intelligence</span>
        <span aria-hidden="true">/</span>
        <strong>Visual study 01</strong>
      </div>
      <div className="oi-fiction-label"><span /> Fictional design prototype</div>
    </header>

    <main>
      <section className="oi-intro" aria-labelledby="oi-title">
        <div className="oi-intro-copy">
          <span className="oi-kicker">Opportunity intelligence · October 18, 2026</span>
          <h1 id="oi-title">A new demand signal.<br /><em>One company worth deeper work.</em></h1>
          <p>ATLAS reviewed the possible beneficiaries of a fictional grid-modernization announcement and separated thematic exposure from evidence that existed before the news.</p>
        </div>
        <a className="oi-primary-action" href="#priority-research">
          View priority research <ArrowDownRight size={18} aria-hidden="true" />
        </a>
      </section>

      <section className="oi-counts" aria-label="Fictional research funnel">
        <div><strong>28</strong><span>possible beneficiaries identified</span></div>
        <div><strong>07</strong><span>had source-backed prior assessments</span></div>
        <div><strong>03</strong><span>survived comparative review</span></div>
        <div className="oi-count-priority"><strong>01</strong><span>priority for deeper research</span></div>
      </section>

      <article className="oi-story" id="priority-research" aria-labelledby="oi-company">
        <div className="oi-story-main">
          <div className="oi-priority-line">
            <span><span className="oi-live-dot" /> Priority research</span>
            <span>Fictional company · illustrative analysis</span>
          </div>

          <div className="oi-company-heading">
            <div>
              <span className="oi-ticker">AGS</span>
              <h2 id="oi-company">Aurum Grid Systems</h2>
              <p>Critical power-control equipment · North America</p>
            </div>
            <div className="oi-conviction">
              <span>Research posture</span>
              <strong>Advance diligence</strong>
              <small>Not an investment recommendation</small>
            </div>
          </div>

          <p className="oi-thesis">The announcement strengthens an existing capacity-expansion thesis; it does not create the thesis. Aurum entered the event with improving order quality and a credible reinvestment path, while peers still require reconciliation of cash generation or balance-sheet risk.</p>

          <SignalChart />

          <div className="oi-evidence-strip" aria-label="Illustrative supporting evidence">
            <div>
              <span>Evidence before news</span>
              <strong>3 filings · 2 earnings updates</strong>
            </div>
            <div>
              <span>New catalyst evidence</span>
              <strong>1 public program announcement</strong>
            </div>
            <div>
              <span>Next verification</span>
              <strong>Backlog conversion and margins</strong>
            </div>
          </div>
        </div>

        <aside className="oi-story-rail" aria-label="Research chronology and remaining risk">
          <section>
            <div className="oi-rail-icon"><Clock3 size={17} aria-hidden="true" /></div>
            <span className="oi-rail-label">Prior thesis · recorded Sep 24</span>
            <h3>Capacity investment was already improving.</h3>
            <p>Earlier fictional research noted a stronger order mix and disciplined expansion, before the new policy signal appeared.</p>
            <span className="oi-source-note"><Check size={13} aria-hidden="true" /> Timestamped browser-local assessment</span>
          </section>

          <section className="oi-rail-catalyst">
            <div className="oi-rail-icon"><ArrowUpRight size={17} aria-hidden="true" /></div>
            <span className="oi-rail-label">New catalyst · Oct 17</span>
            <h3>$4.2B fictional transmission program announced.</h3>
            <p>The program expands the addressable project set. Beneficiary timing and contract awards remain unverified.</p>
            <span className="oi-source-note"><ShieldCheck size={13} aria-hidden="true" /> Illustrative public-source event</span>
          </section>

          <section className="oi-rail-risk">
            <div className="oi-rail-icon"><CircleAlert size={17} aria-hidden="true" /></div>
            <span className="oi-rail-label">Outstanding risk</span>
            <h3>Demand visibility is not earnings conversion.</h3>
            <p>Input costs, award timing, and execution capacity could prevent the catalyst from reaching free cash flow.</p>
          </section>
        </aside>
      </article>

      <section className="oi-peers" aria-labelledby="oi-peers-title">
        <div className="oi-section-heading">
          <div>
            <span className="oi-kicker">Comparative review</span>
            <h2 id="oi-peers-title">Why the alternatives did not rank first</h2>
          </div>
          <p>Theme membership is only the starting point. Priority requires differentiated, source-backed evidence.</p>
        </div>

        <div className="oi-peer-table" role="table" aria-label="Fictional peer comparison">
          <div className="oi-peer-header" role="row">
            <span role="columnheader">Company</span>
            <span role="columnheader">Current signal</span>
            <span role="columnheader">Why it trails</span>
            <span aria-hidden="true" />
          </div>
          {peers.map(peer => <div className="oi-peer-row" role="row" key={peer.ticker}>
            <div role="cell"><strong>{peer.ticker}</strong><span>{peer.name}</span></div>
            <div role="cell" className={`oi-peer-signal oi-peer-${peer.direction}`}><span />{peer.signal}</div>
            <p role="cell">{peer.note}</p>
            <ArrowRight size={17} aria-hidden="true" />
          </div>)}
        </div>
      </section>

      <section className="oi-close" aria-label="Prototype disclosure">
        <ArrowDownRight size={20} aria-hidden="true" />
        <p><strong>Design study, not research output.</strong> Every company, event, figure, and conclusion shown here is fictional and exists only to evaluate information hierarchy and visual direction.</p>
      </section>
    </main>

    <footer className="oi-footer">
      <span>ATLAS / Opportunity Intelligence</span>
      <span>Private wealth interface study · 01</span>
    </footer>
  </div>;
}
