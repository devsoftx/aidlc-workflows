# AI-DLC scopes and stages

Generated tables, kept beside the skill as human-readable data: the engine routes from the compiled scope grid and stage graph, never from these.

## Scope-to-Stage Mapping

The engine resolves scope-level stage routing internally (it reads the compiled scope grid the table below summarises). The summary table is kept here as human-readable data — not dispatch logic — and is regenerated, never hand-edited. (One carve-out: `scope save` adds a plan the human chose to keep to the runtime scope registry (the durable `aidlc/scopes/<name>.md` record, projected into `.cursor/scopes/aidlc-<name>.md` and a `scope-grid.json` entry) - that is the sanctioned write path for saved scopes, not a hand-edit; this summary table itself stays generated.) Source of truth: one file per scope under `.cursor/scopes/aidlc-<name>.md` plus each stage's `scopes:` frontmatter, transposed at `{{INVOKE}} engine graph compile`; regenerate this table with `{{INVOKE}} engine gen scope-table`.

<!-- BEGIN: compiled scope grid via `{{INVOKE}} engine gen scope-table` - do NOT hand-edit -->

| Scope          | Depth         | TestStrategy | EXECUTE / Total |
|----------------|---------------|--------------|-----------------|
| bugfix         | Minimal       | (default)    | 11 / 36         |
| classic        | Standard      | (default)    | 21 / 36         |
| enterprise     | Comprehensive | (default)    | 36 / 36         |
| express        | Minimal       | (default)    | 12 / 36         |
| feature        | Standard      | (default)    | 35 / 36         |
| infra          | Standard      | (default)    | 18 / 36         |
| mvp            | Standard      | (default)    | 25 / 36         |
| poc            | Minimal       | (default)    | 10 / 36         |
| refactor       | Minimal       | (default)    | 12 / 36         |
| security-patch | Minimal       | (default)    | 13 / 36         |
| workshop       | Standard      | Minimal      | 28 / 36         |

<!-- END: compiled scope grid -->

---

## Stage Graph

The engine reads the compiled `data/stage-graph.json` directly for all routing; this table is the human-readable mirror of that graph (each compiled stage, its phase, execution mode, lead/support agents, and run mode) — data, not dispatch logic.

<!-- BEGIN: compiled stage graph via `{{INVOKE}} engine gen stage-table` - do NOT hand-edit -->

| Slug | # | Stage | Phase | Execution | Lead Agent | Support Agents | Mode |
|------|---|-------|-------|-----------|------------|----------------|------|
| workspace-scaffold | 0.1 | Workspace Scaffold | Initialization | ALWAYS | (orchestrator) | — | inline |
| workspace-detection | 0.2 | Workspace Detection | Initialization | ALWAYS | (orchestrator) | — | inline |
| state-init | 0.3 | State Initialization | Initialization | ALWAYS | (orchestrator) | — | inline |
| intent-capture | 1.1 | Intent Capture & Framing | Discover | ALWAYS | aidlc-product-agent | aidlc-architect-agent | inline |
| market-research | 1.2 | Market Research | Discover | CONDITIONAL | aidlc-product-agent | — | inline |
| feasibility | 1.3 | Feasibility & Constraints | Discover | CONDITIONAL | aidlc-architect-agent | aidlc-aws-platform-agent, aidlc-compliance-agent | inline |
| reverse-engineering | 1.4 | Reverse Engineering | Discover | CONDITIONAL | aidlc-developer-agent | aidlc-architect-agent | pipeline |
| scope-definition | 1.5 | Scope Definition | Discover | ALWAYS | aidlc-product-agent | aidlc-delivery-agent | inline |
| team-formation | 1.6 | Team Formation | Discover | CONDITIONAL | aidlc-delivery-agent | — | inline |
| rough-mockups | 1.7 | Rough Mockups | Discover | CONDITIONAL | aidlc-design-agent | aidlc-product-agent | inline |
| approval-handoff | 1.8 | Approval & Handoff | Discover | ALWAYS | aidlc-delivery-agent | aidlc-product-agent | inline |
| practices-discovery | 2.1 | Practices Discovery | Design | CONDITIONAL | aidlc-pipeline-deploy-agent | aidlc-quality-agent, aidlc-developer-agent, aidlc-devsecops-agent | subagent |
| requirements-analysis | 2.2 | Requirements Analysis | Design | ALWAYS | aidlc-product-agent | — | inline |
| user-stories | 2.3 | User Stories | Design | CONDITIONAL | aidlc-product-agent | aidlc-design-agent, aidlc-developer-agent, aidlc-quality-agent | mob |
| refined-mockups | 2.4 | Refined Mockups | Design | CONDITIONAL | aidlc-design-agent | aidlc-product-agent | inline |
| domain-design | 2.5 | Domain Design | Design | CONDITIONAL | aidlc-architect-agent | aidlc-aws-platform-agent, aidlc-design-agent | inline |
| units-generation | 2.6 | Units Generation | Design | ALWAYS | aidlc-architect-agent | aidlc-delivery-agent | inline |
| contract-design | 2.7 | Contract Design | Design | CONDITIONAL | aidlc-architect-agent | aidlc-aws-platform-agent | inline |
| delivery-planning | 2.8 | Delivery Planning | Design | ALWAYS | aidlc-delivery-agent | aidlc-architect-agent | inline |
| functional-design | 2.9 | Functional Design | Design | CONDITIONAL | aidlc-architect-agent | aidlc-developer-agent | inline |
| nfr-requirements | 2.10 | NFR Requirements | Design | CONDITIONAL | aidlc-architect-agent | aidlc-devsecops-agent, aidlc-compliance-agent, aidlc-quality-agent | inline |
| nfr-design | 2.11 | NFR Design | Design | CONDITIONAL | aidlc-architect-agent | aidlc-aws-platform-agent | inline |
| infrastructure-design | 2.12 | Infrastructure Design | Design | CONDITIONAL | aidlc-aws-platform-agent | aidlc-devsecops-agent, aidlc-compliance-agent | inline |
| code-generation | 3.1 | Code Generation | Build | ALWAYS | aidlc-developer-agent | — | subagent |
| build-and-test | 4.1 | Build and Test | Test | ALWAYS | aidlc-quality-agent | aidlc-devsecops-agent | inline |
| performance-validation | 4.2 | Performance Validation | Test | CONDITIONAL | aidlc-quality-agent | — | inline |
| code-review | 5.1 | Code Review | Secure | ALWAYS | aidlc-quality-agent | — | inline |
| security-review | 5.2 | Security Review | Secure | ALWAYS | aidlc-devsecops-agent | — | inline |
| conformance-review | 5.3 | Conformance Review | Secure | CONDITIONAL | aidlc-compliance-agent | — | inline |
| ci-pipeline | 6.1 | CI Pipeline | Deploy | CONDITIONAL | aidlc-pipeline-deploy-agent | — | inline |
| deployment-pipeline | 6.2 | Deployment Pipeline | Deploy | CONDITIONAL | aidlc-pipeline-deploy-agent | — | inline |
| environment-provisioning | 6.3 | Environment Provisioning | Deploy | CONDITIONAL | aidlc-aws-platform-agent | aidlc-devsecops-agent, aidlc-compliance-agent | inline |
| deployment-execution | 6.4 | Deployment Execution | Deploy | CONDITIONAL | aidlc-pipeline-deploy-agent | aidlc-developer-agent | inline |
| observability-setup | 7.1 | Observability Setup | Operate | CONDITIONAL | aidlc-operations-agent | — | inline |
| incident-response | 7.2 | Incident Response | Operate | CONDITIONAL | aidlc-operations-agent | — | inline |
| feedback-optimization | 7.3 | Feedback & Optimization | Operate | CONDITIONAL | aidlc-operations-agent | aidlc-aws-platform-agent | inline |

<!-- END: compiled stage graph -->
