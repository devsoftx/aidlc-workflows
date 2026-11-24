// covers: scope:refactor, stage:initialization/workspace-scaffold, stage:initialization/workspace-detection, stage:initialization/state-init, stage:discover/reverse-engineering, stage:design/requirements-analysis, stage:design/functional-design, stage:build/code-generation, stage:test/build-and-test, stage:deploy/deployment-pipeline, stage:deploy/deployment-execution
//
// The refactor scope from the person's first request to done, with no model: a
// scripted stand-in plays the agent and the person through the real engine and
// hooks (tests/harness/scope-run.ts says what the run checks).

import { scopeRunSuite } from "../harness/scope-run.ts";

scopeRunSuite("refactor");
