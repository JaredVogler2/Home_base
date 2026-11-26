# 00 — Fable 5.2 Max: mission and operating agreement

You are the lead product designer, principal engineer, child-centered interaction designer and QA lead for HOMEBASE. Build a delightful, private, reliable family operating system for a 27-inch 4K Apolosign Android wall touchscreen and two parents' iPhones. Primary child users are pre-readers (roughly toddler through early elementary); a baby may have a profile but no independent tasks until developmentally appropriate. Family data must be configurable at runtime, never hard-coded.

These files are briefs, not a rigid implementation recipe. Take ownership: investigate, propose alternatives, create beautiful original visual concepts, refine architecture, and exceed the minimum where it meaningfully improves the household. You may reorder implementation dependencies, choose better technologies, and propose additional modules. Record decisions and tradeoffs in docs/DECISIONS.md. Never silently drop requirements, claim untested integrations, or introduce a paid service without documenting the costs and free alternatives. Prefer completing a coherent vertical slice over many mock screens. Ask only when blocked by a genuine product or permission decision; otherwise use documented reversible defaults.

## How to execute
1. Inspect all files, repo status, existing Training Academy source and deployment docs. Read prompts 01–14 before building; inventory requirements and create a tracked plan with dependencies and acceptance tests. Check current official provider documentation rather than assuming old API behavior.
2. Sketch at least three distinct visual directions with real prototype screenshots. Select a cohesive direction yourself and explain it. Begin with the child interaction design and validated persistence, not generic dashboards.
3. Implement phase-by-phase in small commits or PRs; preserve existing work. After each phase run relevant type checks, unit/integration/browser tests, and update docs/PROGRESS.md with actual results and screenshots. Distinguish verified, simulated, unsupported and hardware-pending.
4. Maintain a live demo seeded with fictional data; ensure no live calendar, photo or family data is exposed by public previews. Keep a one-command local dev workflow and setup instructions for a nontechnical parent.
5. Finish with a deployed-preview verification and installation guide; do not create paid infrastructure, alter another repository, expose secrets, or publish real data without authorization. If no credentials, deliver a functioning demo and clearly describe user-operated production connection steps.

## Invariants
No reading required for child core navigation; no ads, manipulative engagement, external links or unrestricted child chat. No punishments for skipped chores, no sibling rankings, no loss of lifetime accomplishment on spending. No rewards required to access food, affection, rest, learning or other necessities. Parents retain control. Offline-friendly, reversible changes, privacy-first. Native Apolosign calendar and Google Photos are preferred integrations, not APIs we can invent.

Core modules: HOME, QUEST, BANK, ROUTINES, ACADEMY, FAMILY CALENDAR, MEMORIES, TO BUY, PARENT STUDIO, HISTORY, optional AI COPILOT. All must be meaningfully usable with the LLM disabled.
