// Browser storage helper for DiscoveryBriefingSnapshot
import type { DiscoveryBriefingSnapshot } from './discovery-briefing-model';

export const KEY = 'atlas.autonomous.discovery-briefing.v1';

export function writeDiscoveryBriefing(storage: Storage, snapshot: DiscoveryBriefingSnapshot): void {
  try {
    storage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage errors
  }
}

export function readDiscoveryBriefing(storage: Storage): DiscoveryBriefingSnapshot | null {
  try {
    const data = storage.getItem(KEY);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    
    // Validate version
    if (parsed.version !== 1) return null;
    
    // Validate scan timestamp as ISO 8601 UTC date
    if (typeof parsed.scanCompletedAt !== 'string') return null;
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.?\d*Z$/;
    if (!timestampRegex.test(parsed.scanCompletedAt)) return null;
    
    // Validate issuer count - must be a non-negative finite integer
    if (typeof parsed.issuersExamined !== 'number' || 
        !Number.isFinite(parsed.issuersExamined) || 
        parsed.issuersExamined < 0 || 
        parsed.issuersExamined % 1 !== 0) {
      return null;
    }
    
    // Validate leads
    if (!Array.isArray(parsed.leads)) return null;
    if (parsed.leads.length > 3) return null;
    
    // Check for duplicate tickers
    const tickers = new Set<string>();
    for (const lead of parsed.leads) {
      if (!lead || typeof lead !== 'object') return null;
      
      // Validate required fields exist
      if (typeof lead.ticker !== 'string' || !lead.ticker) return null;
      if (tickers.has(lead.ticker)) return null; // Reject duplicate ticker
      tickers.add(lead.ticker);
      
      if (typeof lead.companyName !== 'string' || !lead.companyName) return null;
      if (typeof lead.preliminaryScreenStatus !== 'string') return null;
      
      // Validate screening status - only allow the exact specified statuses
      const validScreenStatuses = ['preliminary_pass', 'incomplete_financials', 'failed_thresholds', 'stale_financials', 'accounting_review'];
      if (!validScreenStatuses.includes(lead.preliminaryScreenStatus)) return null;
      
      // Validate financial data - allow only null or finite numbers
      if (lead.revenueGrowth !== null && (typeof lead.revenueGrowth !== 'number' || !Number.isFinite(lead.revenueGrowth))) return null;
      if (lead.fcfMargin !== null && (typeof lead.fcfMargin !== 'number' || !Number.isFinite(lead.fcfMargin))) return null;
      if (lead.annualPe !== null && (typeof lead.annualPe !== 'number' || !Number.isFinite(lead.annualPe))) return null;
      
      // Validate emerging strength status
      const validEmergingStatuses = ['improving', 'not_improving', 'insufficient_evidence'];
      if (!validEmergingStatuses.includes(lead.emergingStrength)) return null;
      
      // Validate screening reasons
      if (!Array.isArray(lead.screeningReasons)) return null;
      for (const reason of lead.screeningReasons) {
        if (typeof reason !== 'string') return null;
      }
      
      // Validate evidence limitations if present
      if (lead.evidenceLimitations !== null && !Array.isArray(lead.evidenceLimitations)) return null;
      if (lead.evidenceLimitations !== null) {
        for (const limitation of lead.evidenceLimitations) {
          if (typeof limitation !== 'string') return null;
        }
      }
    }
    
    return parsed as DiscoveryBriefingSnapshot;
  } catch {
    return null;
  }
}