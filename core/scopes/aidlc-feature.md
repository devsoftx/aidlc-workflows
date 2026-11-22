---
name: feature
depth: Standard
keywords: []
description: Full lifecycle for new features, practical depth
skeleton: on
runner: true
guard_policy: off
sensors: on
learnings: on
summary_confirmation: on
plan_approval: on
collaborators: off
---

# feature scope

The full-lifecycle scope for new feature work at practical depth. Like
`enterprise`, it runs nearly every stage in the graph (all but Conformance
Review), but the stage bodies apply Standard rather than Comprehensive depth —
lighter ceremony, the same end-to-end coverage from discover through operate.

Guard Policy defaults to off: changed inputs are recorded and announced, the run continues, and plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.

## Why these stages

A new feature still needs the full arc: understand the problem
(discover), design it (design), build and test it (the unit loop), and
deploy and operate it (deploy and operate). `feature` keeps all of those so nothing silently
drops. The one stage it leaves out is Conformance Review, which `enterprise`,
`security-patch`, `infra`, and `classic` include. The difference from
`enterprise` is depth, expressed in the stage bodies and the org/team rule
layers, plus that one stage.

## Membership

`feature` marks 32 of the 33 stages after Initialization EXECUTE; Conformance
Review is the one it marks SKIP. It is also available through `--scope feature`
and the `/aidlc-feature` runner. There are no keyword triggers of its own.
