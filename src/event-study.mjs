// Pure event-study helpers. Daily bars must represent completed, chronologically ordered sessions.
// Market reaction measures are descriptive outcomes, never information available at event time.
export function easternClock(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(iso) || !Number.isFinite(Date.parse(iso)) || !/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) return null;
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', hourCycle: 'h23', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`, minute:Number(p.hour)*60+Number(p.minute)};
}
export function formatSecAcceptedEastern(iso) {
  if (!easternClock(iso)) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-US', {
    timeZone:'America/New_York', year:'numeric',month:'numeric',day:'numeric',
    hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true,timeZoneName:'short'
  }).format(new Date(iso));
}
export function alignEvent(acceptedAt, bars) {
  const clock = easternClock(acceptedAt);
  if (!clock) return {status:'timestamp-unavailable', firstSession:null, reason:'Precise acceptance time unavailable'};
  if (!Array.isArray(bars) || bars.length < 2) return {status:'insufficient-history', firstSession:null, reason:'Need a pre-event session and an event session'};
  // Before 16:00 ET, the session on that date can have reacted; at/after 16:00 use next session.
  const index = bars.findIndex(b => b.date > clock.date || (b.date === clock.date && clock.minute < 16*60));
  if (index < 1) return {status:'insufficient-history', firstSession:null, reason:'No earlier session or no covered post-event session'};
  return {status:'aligned', firstSession:bars[index].date, index, reason:clock.minute >= 16*60 ? 'After-hours alignment to next session' : 'First available session at or after event'};
}
export function eventStudy(acceptedAt,bars) {
  const aligned = alignEvent(acceptedAt,bars);
  if (aligned.status !== 'aligned') return {...aligned, returns:{day1:null,day3:null,day5:null}};
  const i=aligned.index, baseline=bars[i-1]?.close;
  const valid=x=>Number.isFinite(x)&&x>0;
  const result={};
  for(const n of [1,3,5]){
    const close=bars[i+n-1]?.close;
    result['day'+n]=valid(baseline)&&valid(close)?(close/baseline-1)*100:null;
  }
  return {...aligned, baselineSession:bars[i-1].date, returns:result, completeHorizons:[1,3,5].filter(n=>result['day'+n]!==null)};
}
