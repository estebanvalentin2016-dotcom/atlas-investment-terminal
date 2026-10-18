import {describe,expect,it} from 'vitest';
import type {DiscoveryBriefingSnapshot} from './discovery-briefing-model';
import {KEY,readDiscoveryBriefing,writeDiscoveryBriefing} from './discovery-briefing-storage';

function memoryStorage():Storage {
  const entries=new Map<string,string>();
  return {
    get length(){return entries.size},
    clear(){entries.clear()},
    getItem(key){return entries.get(key)??null},
    key(index){return [...entries.keys()][index]??null},
    removeItem(key){entries.delete(key)},
    setItem(key,value){entries.set(key,value)}
  };
}

const snapshot=(scanCompletedAt:string):DiscoveryBriefingSnapshot=>({
  version:1,
  scanCompletedAt,
  issuersExamined:24,
  leads:[
    {
      ticker:'IMPV',
      companyName:'Improving Company',
      preliminaryScreenStatus:'preliminary_pass',
      revenueGrowth:12.5,
      fcfMargin:18.4,
      annualPe:21.3,
      emergingStrength:'improving',
      screeningReasons:['Reported growth and free cash flow passed the preliminary screen'],
      evidenceLimitations:null
    },
    {
      ticker:'FLAT',
      companyName:'Flat Company',
      preliminaryScreenStatus:'preliminary_pass',
      revenueGrowth:8.2,
      fcfMargin:11.1,
      annualPe:null,
      emergingStrength:'not_improving',
      screeningReasons:['Free cash flow remained positive'],
      evidenceLimitations:['Completed market price unavailable']
    }
  ]
});

describe('Discovery briefing storage contract',()=>{
  it('round-trips a UTC ISO timestamp, issuer count, and Emerging Strength evidence',()=>{
    const storage=memoryStorage();
    const briefing=snapshot('2026-10-18T16:42:17.123Z');

    writeDiscoveryBriefing(storage,briefing);

    const restored=readDiscoveryBriefing(storage);
    expect(restored).toEqual(briefing);
    expect(restored?.issuersExamined).toBe(24);
    expect(restored?.leads.map(lead=>lead.emergingStrength)).toEqual(['improving','not_improving']);
  });

  it('rejects a date-only completion value rather than weakening timestamp validation',()=>{
    const storage=memoryStorage();
    storage.setItem(KEY,JSON.stringify(snapshot('2026-10-18')));

    expect(readDiscoveryBriefing(storage)).toBeNull();
  });

  it('accepts the full UTC ISO format produced by Date.toISOString()',()=>{
    const storage=memoryStorage();
    const completedAt=new Date('2026-10-18T16:42:17.123Z').toISOString();
    storage.setItem(KEY,JSON.stringify(snapshot(completedAt)));

    expect(readDiscoveryBriefing(storage)?.scanCompletedAt).toBe(completedAt);
  });
});
