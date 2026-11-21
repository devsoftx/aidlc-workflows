// covers: scope:infra, stage:initialization/workspace-scaffold, stage:initialization/workspace-detection, stage:initialization/state-init, stage:design/practices-discovery, stage:design/requirements-analysis, stage:design/nfr-requirements, stage:design/nfr-design, stage:design/infrastructure-design, stage:deploy/ci-pipeline, stage:deploy/deployment-pipeline, stage:deploy/environment-provisioning, stage:deploy/deployment-execution, stage:operate/observability-setup
//
// The infra scope from the person's first request to done, with no model: a
// scripted stand-in plays the agent and the person through the real engine and
// hooks (tests/harness/scope-run.ts says what the run checks).

import { scopeRunSuite } from "../harness/scope-run.ts";

scopeRunSuite("infra");
