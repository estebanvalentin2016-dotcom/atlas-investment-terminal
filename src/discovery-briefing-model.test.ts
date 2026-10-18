import { describe, it, expect } from 'vitest';
import { buildDiscoveryBriefing } from './discovery-briefing-model';
import type { DiscoveryBriefingInput } from './discovery-briefing-model';

describe('buildDiscoveryBriefing', () => {
  it('should deduplicate leads by ticker while preserving order and keep first 3 unique leads', () => {
    const input: DiscoveryBriefingInput = {
      scanCompletedAt: '2023-01-01T00:00:00.000Z',
      issuersExamined: 100,
      leads: [
        {
          ticker: 'AAPL',
          companyName: 'Apple Inc.',
          preliminaryScreenStatus: 'preliminary_pass',
          revenueGrowth: 0.15,
          fcfMargin: 0.25,
          annualPe: 25.5,
          emergingStrength: 'improving',
          screeningReasons: ['Revenue growth above 10%'],
          evidenceLimitations: null
        },
        {
          ticker: 'AAPL',
          companyName: 'Apple Inc.',
          preliminaryScreenStatus: 'preliminary_pass',
          revenueGrowth: 0.15,
          fcfMargin: 0.25,
          annualPe: 25.5,
          emergingStrength: 'improving',
          screeningReasons: ['Revenue growth above 10%'],
          evidenceLimitations: null
        },
        {
          ticker: 'MSFT',
          companyName: 'Microsoft Corporation',
          preliminaryScreenStatus: 'preliminary_pass',
          revenueGrowth: 0.12,
          fcfMargin: 0.30,
          annualPe: 35.2,
          emergingStrength: 'improving',
          screeningReasons: ['Revenue growth above 10%'],
          evidenceLimitations: null
        },
        {
          ticker: 'NVDA',
          companyName: 'NVIDIA Corporation',
          preliminaryScreenStatus: 'preliminary_pass',
          revenueGrowth: 0.20,
          fcfMargin: 0.40,
          annualPe: 45.8,
          emergingStrength: 'improving',
          screeningReasons: ['Revenue growth above 10%'],
          evidenceLimitations: null
        }
      ]
    };

    const result = buildDiscoveryBriefing(input);
    
    expect(result.leads).toHaveLength(3);
    expect(result.leads[0].ticker).toBe('AAPL');
    expect(result.leads[1].ticker).toBe('MSFT');
    expect(result.leads[2].ticker).toBe('NVDA');
    expect(result.scanCompletedAt).toBe(input.scanCompletedAt);
    expect(result.issuersExamined).toBe(input.issuersExamined);
  });

  it('should preserve fewer than 3 unique leads', () => {
    const input: DiscoveryBriefingInput = {
      scanCompletedAt: '2023-01-01T00:00:00.000Z',
      issuersExamined: 50,
      leads: [
        {
          ticker: 'AAPL',
          companyName: 'Apple Inc.',
          preliminaryScreenStatus: 'preliminary_pass',
          revenueGrowth: 0.15,
          fcfMargin: 0.25,
          annualPe: 25.5,
          emergingStrength: 'improving',
          screeningReasons: ['Revenue growth above 10%'],
          evidenceLimitations: null
        },
        {
          ticker: 'MSFT',
          companyName: 'Microsoft Corporation',
          preliminaryScreenStatus: 'preliminary_pass',
          revenueGrowth: 0.12,
          fcfMargin: 0.30,
          annualPe: 35.2,
          emergingStrength: 'improving',
          screeningReasons: ['Revenue growth above 10%'],
          evidenceLimitations: null
        }
      ]
    };

    const result = buildDiscoveryBriefing(input);
    
    expect(result.leads).toHaveLength(2);
    expect(result.leads[0].ticker).toBe('AAPL');
    expect(result.leads[1].ticker).toBe('MSFT');
    expect(result.scanCompletedAt).toBe(input.scanCompletedAt);
    expect(result.issuersExamined).toBe(input.issuersExamined);
  });

  it('should preserve scan metadata and financial evidence without modification', () => {
    const input: DiscoveryBriefingInput = {
      scanCompletedAt: '2023-12-31T23:59:59.999Z',
      issuersExamined: 75,
      leads: [
        {
          ticker: 'TSLA',
          companyName: 'Tesla Inc.',
          preliminaryScreenStatus: 'preliminary_pass',
          revenueGrowth: null,
          fcfMargin: 0.18,
          annualPe: 22.3,
          emergingStrength: 'not_improving',
          screeningReasons: ['FCF margin above 15%'],
          evidenceLimitations: ['Historical price data incomplete']
        }
      ]
    };

    const result = buildDiscoveryBriefing(input);
    
    expect(result.scanCompletedAt).toBe(input.scanCompletedAt);
    expect(result.issuersExamined).toBe(input.issuersExamined);
    expect(result.leads[0].ticker).toBe('TSLA');
    expect(result.leads[0].companyName).toBe('Tesla Inc.');
    expect(result.leads[0].preliminaryScreenStatus).toBe('preliminary_pass');
    expect(result.leads[0].revenueGrowth).toBeNull();
    expect(result.leads[0].fcfMargin).toBe(0.18);
    expect(result.leads[0].annualPe).toBe(22.3);
    expect(result.leads[0].emergingStrength).toBe('not_improving');
    expect(result.leads[0].screeningReasons).toEqual(['FCF margin above 15%']);
    expect(result.leads[0].evidenceLimitations).toEqual(['Historical price data incomplete']);
  });

  it('should not mutate the original input', () => {
    const input: DiscoveryBriefingInput = {
      scanCompletedAt: '2023-06-15T12:00:00.000Z',
      issuersExamined: 25,
      leads: [
        {
          ticker: 'GOOGL',
          companyName: 'Alphabet Inc.',
          preliminaryScreenStatus: 'preliminary_pass',
          revenueGrowth: 0.08,
          fcfMargin: 0.22,
          annualPe: 28.7,
          emergingStrength: 'not_improving',
          screeningReasons: ['Revenue growth above 10%'],
          evidenceLimitations: null
        },
        {
          ticker: 'GOOGL',
          companyName: 'Alphabet Inc.',
          preliminaryScreenStatus: 'preliminary_pass',
          revenueGrowth: 0.08,
          fcfMargin: 0.22,
          annualPe: 28.7,
          emergingStrength: 'not_improving',
          screeningReasons: ['Revenue growth above 10%'],
          evidenceLimitations: null
        }
      ]
    };

    const inputCopy = JSON.parse(JSON.stringify(input));
    buildDiscoveryBriefing(input);
    
    expect(input).toEqual(inputCopy);
  });
});