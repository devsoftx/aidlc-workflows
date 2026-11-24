// covers: scope:feature, stage:initialization/workspace-scaffold, stage:initialization/workspace-detection, stage:initialization/state-init, stage:discover/intent-capture, stage:discover/market-research, stage:discover/feasibility, stage:discover/scope-definition, stage:discover/team-formation, stage:discover/rough-mockups, stage:discover/approval-handoff, stage:design/practices-discovery, stage:design/requirements-analysis, stage:design/user-stories, stage:design/refined-mockups, stage:design/domain-design, stage:design/units-generation, stage:design/contract-design, stage:design/delivery-planning, stage:design/functional-design, stage:design/nfr-requirements, stage:design/nfr-design, stage:design/infrastructure-design, stage:build/code-generation, stage:test/build-and-test, stage:deploy/ci-pipeline, stage:deploy/deployment-pipeline, stage:deploy/environment-provisioning, stage:deploy/deployment-execution, stage:operate/observability-setup, stage:operate/incident-response, stage:test/performance-validation, stage:operate/feedback-optimization
//
// The feature scope from the person's first request to done, with no model: a
// scripted stand-in plays the agent and the person through the real engine and
// hooks (tests/harness/scope-run.ts says what the run checks).

import { scopeRunSuite } from "../harness/scope-run.ts";

scopeRunSuite("feature");
