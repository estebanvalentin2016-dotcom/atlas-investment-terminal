# ATLAS — Debt Evidence Presentation

## Implemented Behavior

The financing panel distinguishes among:

- Debt components with source-backed values
- Debt components explicitly reported as zero
- Debt components for which supported SEC facts were not found

When all three tracked categories are available, ATLAS displays their sum as an **identified debt-component subtotal**. It does not describe that subtotal as total company debt or as complete debt evidence.

When any tracked category is unavailable, ATLAS does not calculate the subtotal and identifies how many tracked components are missing. In both cases, the panel explains that total company debt remains unverified until leases, convertible instruments, other borrowings, classifications, and maturities are reconciled.

## Scope

The implementation changes presentation and regression coverage only:

- `src/FinancingAutomationPanel.tsx` presents the tracked components, source periods, filing dates, and subtotal limitations.
- `src/debt-component.test.ts` covers complete tracked components, an unavailable component, and explicitly reported zero values.

No debt arithmetic, SEC fact extraction, completeness criteria, or styling was changed as part of this correction.

## Interpretation Limit

The displayed component evidence is a research aid, not a conclusion about total debt, capital structure, maturity risk, or creditworthiness.
