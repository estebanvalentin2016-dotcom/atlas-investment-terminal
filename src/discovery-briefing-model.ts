import type { ScreenResult } from './autonomous-screen';
import type { FcfStrengthAssessment } from './ranking-model';

export interface DiscoveryBriefingSnapshot {
  version: 1;
  scanCompletedAt: string;
  issuersExamined: number;
  leads: Array<{
    ticker: string;
    companyName: string;
    preliminaryScreenStatus: ScreenResult['status'];
    revenueGrowth: number | null;
    fcfMargin: number | null;
    annualPe: number | null;
    emergingStrength: FcfStrengthAssessment['status'];
    screeningReasons: string[];
    evidenceLimitations: string[] | null;
  }>;
}

export type DiscoveryBriefingInput = {
  scanCompletedAt: string;
  issuersExamined: number;
  leads: DiscoveryBriefingSnapshot['leads'];
};

export function buildDiscoveryBriefing(input: DiscoveryBriefingInput): DiscoveryBriefingSnapshot {
  // Deduplicate all input leads by ticker, preserving first occurrence and original order
  const seenTickers = new Set<string>();
  const uniqueLeads = input.leads.filter(lead => {
    if (seenTickers.has(lead.ticker)) {
      return false;
    }
    seenTickers.add(lead.ticker);
    return true;
  });
  
  // Then keep the first 3 unique leads
  const leads = uniqueLeads.slice(0, 3);
  
  return {
    version: 1,
    scanCompletedAt: input.scanCompletedAt,
    issuersExamined: input.issuersExamined,
    leads: leads
  };
}