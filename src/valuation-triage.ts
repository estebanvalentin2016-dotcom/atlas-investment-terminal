import type {AnnualPe} from './ranking-model';
export type ValuationCaution={level:'high_multiple'|'elevated_multiple'|'unverified'|'no_automatic_flag';headline:string;explanation:string;rank:number};
export function flagIndicativeFyValuation(value:AnnualPe|null):ValuationCaution{
 const pe=value?.pe;
 if(pe===null||pe===undefined||!Number.isFinite(pe)||pe<=0)return {level:'unverified',headline:'Valuation not established',explanation:'No reliable matching annual diluted EPS / IEX close multiple. An unknown P/E is not inexpensive.',rank:2};
 if(pe>=80)return {level:'high_multiple',headline:'High valuation hurdle · '+pe.toFixed(1)+'× FY P/E',explanation:'A very high annual earnings multiple requires exceptional sustained growth to justify its price. No fair value or remaining upside has been established; nonrecurring earnings, splits and accounting adjustments require review.',rank:2};
 if(pe>=40)return {level:'elevated_multiple',headline:'Elevated FY earnings multiple · '+pe.toFixed(1)+'×',explanation:'A rich reported earnings multiple raises the required future growth; it is not automatically overpriced or a sell recommendation.',rank:1};
 return {level:'no_automatic_flag',headline:'No extreme FY P/E warning · '+pe.toFixed(1)+'×',explanation:'A lower annual multiple alone does not demonstrate undervaluation. Business quality, normalized earnings, dilution and downside remain unknown.',rank:0};
}
