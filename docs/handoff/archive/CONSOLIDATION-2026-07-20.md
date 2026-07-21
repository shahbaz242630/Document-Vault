# Handoff Consolidation Record — 2026-07-20

The active handoffs were consolidated on 2026-07-20 because they had accumulated session-by-session evidence and conflicting next-step instructions.

## Immutable Pre-Consolidation Snapshot

The complete prior versions of all three active handoffs are preserved in Git commit `96e89c1`:

- `HANDOFF.md` — 182 lines
- `SECURITY_HANDOFF.md` — 222 lines
- `MVP_HANDOFF.md` — 1,339 lines

Use Git history when detailed deployment IDs, individual category-migration evidence, provider research links, exact historical test counts, or superseded phase narratives are needed. Do not copy those diaries back into the active handoffs.

Example read-only commands:

```powershell
git show 96e89c1:HANDOFF.md
git show 96e89c1:SECURITY_HANDOFF.md
git show 96e89c1:MVP_HANDOFF.md
```

## Active Document Responsibilities

- `HANDOFF.md` owns overall product/repository state, completed capabilities, cross-project blockers, technical debt, and the single active slice.
- `SECURITY_HANDOFF.md` owns non-negotiable security rules, environment/release gates, security debt, and security verification.
- `MVP_HANDOFF.md` owns public website, owner web vault, claimant architecture, delivery state, and the ordered MVP execution plan.
- `apps/web/LEGAL_CONTENT_REVIEW.md` owns the detailed public/legal publication checklist.

Historical project material from before the earlier consolidation remains in `HANDOFF-2026-06-08-pre-archive.md` and Git history.
