import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = mkdtempSync(join(tmpdir(), "flaky-receipt-tests-"));
const script = fileURLToPath(new URL("./verify-runs.mjs", import.meta.url));
let sequence = 0;
after(() => rmSync(directory, { recursive: true }));

function reportFile(report) {
  const path = join(directory, `report-${++sequence}.json`);
  writeFileSync(path, JSON.stringify(report));
  return path;
}

function vitest({
  startTime = 1,
  status = "passed",
  title = "target",
  retryCount,
  success = true,
  numFailedTestSuites = 0,
} = {}) {
  return {
    startTime,
    success,
    numFailedTests: success ? 0 : 1,
    numFailedTestSuites,
    testResults: [
      {
        name: "example.test.ts",
        status: success ? "passed" : "failed",
        assertionResults: [
          {
            title,
            fullName: `suite ${title}`,
            status,
            failureMessages: [],
            ...(retryCount === undefined ? {} : { retryCount }),
          },
        ],
      },
    ],
  };
}

function playwright({
  results = [{ status: "passed", retry: 0 }],
  status = "expected",
  expectedStatus = "passed",
  flaky = 0,
  errors = [],
} = {}) {
  return {
    stats: { unexpected: 0, flaky },
    errors,
    suites: [
      {
        title: "example.spec.ts",
        file: "example.spec.ts",
        specs: [],
        suites: [
          {
            title: "suite",
            specs: [
              {
                title: "target",
                file: "example.spec.ts",
                ok: true,
                tests: [
                  { projectName: "chromium", expectedStatus, status, results },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function run(framework, reports, extra = []) {
  return spawnSync(
    process.execPath,
    [
      script,
      "--framework",
      framework,
      "--target",
      "target",
      "--min-runs",
      String(reports.length),
      ...extra,
      ...reports,
    ],
    { encoding: "utf8" },
  );
}

test("accepts distinct passing Vitest artifacts and exposes retry/provenance limits", () => {
  const result = run("vitest", [
    reportFile(vitest()),
    reportFile(vitest({ startTime: 2 })),
  ]);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.reportsVerified, 2);
  assert.equal(summary.selectedTestExecutions, 2);
  assert.match(summary.retryEvidence, /may omit retries/);
  assert.match(summary.limitations, /do not prove independent execution/);
});

test("rejects zero matches and skipped targets even when the suite reports success", () => {
  for (const report of [
    vitest({ title: "another test" }),
    vitest({ status: "pending" }),
  ]) {
    const result = run("vitest", [reportFile(report)]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Target not found|Target status is pending/);
  }
});

test("rejects duplicate paths and copied report contents", () => {
  const path = reportFile(vitest());
  assert.match(run("vitest", [path, path]).stderr, /Duplicate report path/);
  const result = run("vitest", [path, reportFile(vitest())]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Duplicate report contents/);
});

test("rejects reported Vitest failures and retries", () => {
  for (const report of [
    vitest({ success: false }),
    vitest({ retryCount: 1 }),
    vitest({ numFailedTestSuites: 1 }),
  ]) {
    assert.equal(run("vitest", [reportFile(report)]).status, 1);
  }
});

test("accepts a first-attempt Playwright pass through nested suites", () => {
  const result = run("playwright", [reportFile(playwright())]);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.selectedTestExecutions, 1);
  assert.equal(
    summary.reports[0].selected[0].name,
    "example.spec.ts > suite > target",
  );
});

test("rejects a recovered retry even if Playwright final status says expected", () => {
  const result = run("playwright", [
    reportFile(
      playwright({
        results: [
          { status: "failed", retry: 0 },
          { status: "passed", retry: 1 },
        ],
      }),
    ),
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /multiple attempts/);
});

test("rejects Playwright skip, expected failure, zero attempts, runtime error, and flaky stats", () => {
  for (const report of [
    playwright({ status: "skipped", results: [] }),
    playwright({ expectedStatus: "failed" }),
    playwright({ results: [] }),
    playwright({ errors: [{ message: "runner failed" }] }),
    playwright({ flaky: 1 }),
  ]) {
    assert.equal(run("playwright", [reportFile(report)]).status, 1);
  }
});

test("rejects malformed input, invalid options and insufficient report count", () => {
  const invalid = join(directory, "invalid.json");
  writeFileSync(invalid, "not JSON");
  const malformed = run("vitest", [invalid]);
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /Invalid JSON report/);
  const insufficient = spawnSync(
    process.execPath,
    [
      script,
      "--framework",
      "vitest",
      "--target",
      "target",
      "--min-runs",
      "2",
      reportFile(vitest()),
    ],
    { encoding: "utf8" },
  );
  assert.equal(insufficient.status, 1);
  assert.match(insufficient.stderr, /Need at least 2/);
  assert.equal(run("unsupported", [reportFile(vitest())]).status, 1);
});
