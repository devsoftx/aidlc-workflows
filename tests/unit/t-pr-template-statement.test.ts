// The pull request template's acknowledgment is the Contributor Statement that
// pull-request-lint.yml's "Require Contributor Statement" job looks for. That
// job builds the LICENSE link from the repository the pull request is opened
// in, so a body taken from the template passes only when the template links
// this repository's LICENSE (and its CONTRIBUTING guide, the same way).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_RELEASE_REPOSITORY } from "../../core/tools/aidlc-release.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const TEMPLATE = readFileSync(join(REPO_ROOT, ".github", "pull_request_template.md"), "utf-8");
const LINT = readFileSync(join(REPO_ROOT, ".github", "workflows", "pull-request-lint.yml"), "utf-8");

describe("the pull request template", () => {
  test("carries the Contributor Statement the lint job expects in this repository", () => {
    // The workflow expression the job fills in with the repository's owner/name.
    const repositoryExpression = `$${"{{ github.repository }}"}`;
    const expected = /^\s*EXPECTED: (.+)$/m.exec(LINT)?.[1];
    expect(expected).toBeDefined();
    expect(expected).toContain(`https://github.com/${repositoryExpression}/blob/main/LICENSE`);
    // The repository this project publishes from is the one its pull requests are opened in.
    const statement = (expected as string).replace(repositoryExpression, DEFAULT_RELEASE_REPOSITORY);
    expect(TEMPLATE).toContain(statement);
    expect(TEMPLATE).toContain(`https://github.com/${DEFAULT_RELEASE_REPOSITORY}/blob/main/CONTRIBUTING.md`);
  });
});
