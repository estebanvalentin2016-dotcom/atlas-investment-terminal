# Experimental comparable FCF — research comparison

**Status: candidate methodology only; not approved commercial research.** This
module is not connected to Autonomous Discovery, rankings, saved research, or
investor-facing screens. `atlas-comparable-fcf-candidate-v1` is an ATLAS-defined
non-GAAP measure: reconciled operating cash flow less cash purchases of
productive long-lived assets (PP&E, capitalized software, and productive
intangibles). The SEC reports the underlying cash-flow lines, **not** this FCF.

The candidate requires matching US-GAAP annual USD facts, issuer, fiscal start
and end, filing accession, reporting scope, and assessment-date eligibility.
Its aggregate route uses `PaymentsToAcquireProductiveAssets` alone; its
component route uses reviewed, non-overlapping cash-purchase lines. It never
adds an aggregate to components or treats a missing component as zero. A dated
filing-review attestation must cover statement captions and any omitted
productive-purchase category. The code checks the attestation's structure and
links but cannot independently authenticate its reviewer or caption text.

## Filing-backed examples (USD, fiscal years shown)

| Issuer | Existing production FCF | Candidate v1 calculation | Why they differ |
| --- | ---: | ---: | --- |
| NVIDIA FY2026 | Withheld: no matching supported PP&E-only fact | $102.718B OCF − $6.042B aggregate productive-asset purchases = **$96.676B** | The 10-K reports one cash line for purchases related to property, equipment, and intangible assets. Candidate uses that broad line, without also adding an overlapping PP&E component. |
| AMD FY2025 | Withheld: total-company OCF and continuing-only PP&E are scope-incompatible | $6.493B continuing OCF − $0.974B continuing PP&E purchases = **$5.519B** | The filing separately reports $1.216B discontinued-operation OCF. The candidate excludes that amount and relies on review of the continuing investing scope. |
| CrowdStrike FY2026 | $1.310241B (OCF less PP&E only) | $1.612349B OCF − $0.302108B PP&E − $0.068751B separately capitalized software = **$1.241490B** | The candidate includes the separate software-development cash purchase. It does not include acquisitions or strategic investments. |

Sources: [NVIDIA FY2026 10-K](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm), [AMD FY2025 10-K](https://www.sec.gov/Archives/edgar/data/2488/000000248826000018/amd-20251227.htm), and [CrowdStrike FY2026 10-K](https://www.sec.gov/Archives/edgar/data/1535527/000153552726000010/crwd-20260131.htm). The fixture amounts and arithmetic are reproducible in `src/experimental-comparable-fcf.test.ts`; they are not a live SEC ingestion or independent accounting opinion.

## Explicitly withheld cases

The candidate returns a reason and `value: null` for missing facts; an
unverified or incomplete filing review; incompatible periods or scope; facts
filed after the assessment date; unreconciled amendments/restatements;
unsupported taxonomy or noncash concepts; negative cash-purchase values;
aggregate/component overlap; or component lines whose separation is not
documented. A reported zero remains zero. Negative operating cash flow remains
negative after subtracting purchases.

## Decisions before any production use

- Obtain qualified accounting review of which cash purchases qualify as
  productive long-lived assets, including separately capitalized software,
  intangibles, and financed/noncash asset additions.
- Define an auditable filing-review process. Current review metadata is a
  caller-supplied attestation; code cannot prove the caption or completeness.
- Resolve amended filings, later restatements, and exact SEC publication time
  (the foundation currently stores the SEC filing date, not acceptance time).
- Define separate treatment for banks, insurers, REITs, and unsupported IFRS
  reporters. No generic candidate calculation should be published for them.
- Validate additional issuer/filing styles and independent cash-flow
  reconciliations before considering screening, ranking, or commercial use.
