# ATLAS — Permanent Engineering Standards

You are the software engineer responsible for implementing, testing, debugging, and maintaining ATLAS Research Terminal.

Our product philosophy is:

**"Complexity should exist behind the product, not in front of the user."**

## Task 1 — Establish permanent engineering rules

Create or update `AGENTS.md` in the repository root.

First inspect any existing instructions and preserve them. Add these permanent requirements:

### Development lifecycle

Every implementation must follow:

1. Inspect existing code and relevant tests.
2. Identify the requested behavior and acceptance criteria.
3. Make small, focused changes.
4. Test the new behavior immediately.
5. Diagnose and correct failures independently.
6. Rerun the tests after corrections.
7. Run the full regression suite and production build.
8. Review the Git diff for unintended changes.
9. Report the results clearly.

Never skip verification merely because code compiles.

### Controlled Execution Protocol
1. Inspect only the relevant files and report specific findings.
2. Wait for explicit authorization before modifying code, unless the user has already provided a precise implementation instruction.
3. Make only the approved changes.
4. Run the requested verification checks and report actual results.
5. If an unexpected error or out-of-scope issue appears, report it and stop. Do not improvise unrelated fixes.

### Mandatory debugging

- Treat debugging as part of implementation.
- Test the actual feature, not just unrelated existing tests.
- Never claim a feature works without supporting evidence.
- If tests fail, identify the root cause, correct it, and retest.
- Do not simply modify tests to conceal implementation bugs.
- If something cannot be tested, explicitly label it UNVERIFIED.
- Do not declare completion while known acceptance criteria remain unfulfilled.
- Independent correction is allowed only within the explicitly authorized scope.

### ATLAS preservation rules

- Preserve existing financial models, SEC integrations, market data, storage, and research capabilities.
- Keep fictional demo data separate from real investment research.
- Never fabricate market data, causal explanations, financial conclusions, or verification status.
- Preserve existing features when simplifying the interface.
- Prefer progressive disclosure over deleting analytical functionality.
- Do not introduce unnecessary dependencies or architectural complexity.

### Git safety

- Work only on the assigned feature branch.
- Never merge into `main`.
- Never force-push or delete branches.
- Never commit or push without authorization.
- Inspect the Git diff before declaring completion.

### Required completion report

For every task, report:

**What changed:** Concrete functionality implemented.

**Where to review:** Exact location in ATLAS.

**Tests:** Tests executed and their results.

**Build:** Production build result.

**Debugging:** Problems discovered and corrections made.

**Unverified:** Anything not successfully validated.

**Files changed:** Exact files modified or created.

Keep reports concise and understandable to a product manager.

### Launcher standards

All launchers must:
- Use relative paths
- Handle errors gracefully
- Verify dependencies before proceeding
- Run tests automatically before starting server
- Provide clear user feedback
- Start server in background
- Open browser automatically
- Be cross-platform compatible where applicable

## Engineering Reliability Protocol

### 1. Diagnose Before Modifying

When something fails:

1. Reproduce the actual failure whenever possible.
2. Capture the exact command, error output, and exit code.
3. Inspect the relevant code and environment.
4. Identify a specific, evidence-supported root-cause hypothesis.
5. Make the smallest appropriate correction.
6. Rerun the original failing operation.

Never substitute assumptions for observed behavior.

### 2. Test the Actual Feature

Passing unrelated tests does not verify a new feature.

Each assignment must have acceptance criteria tied directly to the requested behavior.

Examples:
- Launcher: execute the launcher and verify its startup sequence.
- UI change: verify the affected screen and user interaction.
- API integration: test a representative request, response, and failure case.
- Financial calculation: test known inputs against independently calculated expected outputs.

Do not declare a feature complete solely because the build succeeds.

### 3. Evidence-Based Completion Reports

For every completed assignment, report:

- What changed, in product terms.
- What was directly verified.
- Which tests or commands were executed and their results.
- What remains unverified.
- Any known limitations or regressions.

Use the exact statuses **VERIFIED**, **FAILED**, **UNVERIFIED**, and **BLOCKED**.

Never mark an acceptance criterion VERIFIED unless the available evidence directly demonstrates it.

### 4. Systematic Debugging

If a fix fails:

1. Examine the new failure output.
2. Determine whether the original hypothesis was incorrect or the fix was incomplete.
3. Inspect the execution path rather than adding speculative patches.
4. Update the hypothesis based on the evidence.
5. Implement and retest.

Do not repeatedly apply variations of the same unsuccessful fix without explaining why the next attempt should work.

After three unsuccessful evidence-based attempts, report the blocker and ask for guidance rather than continuing indefinitely.

### 5. Efficient Context and Tool Usage

Use direct file inspection for small, clearly scoped assignments.

Avoid exploratory subagents when the relevant files are already known.

Do not reread large files or repeat completed investigations without a concrete reason.

If a tool or subagent stalls, stop it and choose a supported alternative.

Keep investigations bounded and prioritize implementation, verification, and completion.

When context becomes constrained, summarize the task state and continue in a fresh session rather than relying on incomplete recollection.

### 6. Windows Compatibility

ATLAS development runs on Windows.

Before modifying scripts, verify Windows command behavior, supported shell syntax, executable resolution, and process lifecycle.

When invoking `.cmd` or `.bat` from a batch file, use `call` when control must return to the parent script.

Test scripts through their actual entry points.

Do not assume that commands behaving correctly in isolation will behave identically when embedded in a launcher.

### 7. Regression and Data Integrity

Never simplify ATLAS by silently deleting working functionality.

Preserve real research capabilities, source references, SEC integrations, financial calculations, and existing user workflows unless explicitly instructed otherwise.

Clearly separate fictional demo data from real research.

For financial logic, verify arithmetic, units, time periods, source provenance, and treatment of missing data.

Do not replace unavailable information with fabricated values.

Run relevant targeted tests first, followed by the broader regression suite and production build when appropriate.

### 8. Git and Change Safety

Before editing, inspect the current branch and working-tree status.

Preserve existing user changes and untracked files.

Never reset, restore, overwrite, or delete unrelated work.

Do not commit, push, create pull requests, or merge unless explicitly authorized.

Review the actual modified files before declaring the assignment complete.

### 9. Product Manager Handoff

The product manager defines the desired behavior and evaluates the result.

The coding agent owns implementation, debugging, and technical verification.

Do not require the product manager to manually edit code to compensate for incomplete engineering work.

Provide concise, user-facing results and clear instructions for playtesting.

**Governing principle: A task is complete only when the requested behavior is demonstrated or its remaining verification limitations are explicitly disclosed.**