#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";

const usage =
  'Usage: node verify-runs.mjs --framework vitest|playwright --target "exact title or full name" --min-runs N report.json ...';

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value, label) {
  requireValue(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `Invalid ${label}: expected an object.`,
  );
  return value;
}

function array(value, label) {
  requireValue(
    Array.isArray(value),
    `Invalid ${label}: expected an array. Check the installed runner's JSON reporter format.`,
  );
  return value;
}

function options(args) {
  const result = { files: [] };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--") {
      result.files.push(...args.slice(index + 1));
      break;
    }
    if (["--framework", "--target", "--min-runs"].includes(argument)) {
      requireValue(
        index + 1 < args.length,
        `${argument} needs a value.\n${usage}`,
      );
      requireValue(
        result[argument] === undefined,
        `Duplicate option ${argument}.`,
      );
      result[argument] = args[++index];
    } else {
      requireValue(
        !argument.startsWith("-"),
        `Unknown option ${argument}.\n${usage}`,
      );
      result.files.push(argument);
    }
  }
  requireValue(["vitest", "playwright"].includes(result["--framework"]), usage);
  requireValue(
    typeof result["--target"] === "string" &&
      result["--target"].trim().length > 0,
    usage,
  );
  const minimum = Number(result["--min-runs"]);
  requireValue(
    Number.isSafeInteger(minimum) && minimum > 0,
    "--min-runs must be a positive integer.",
  );
  requireValue(
    result.files.length >= minimum,
    `Need at least ${minimum} distinct per-run reports; received ${result.files.length}.`,
  );
  return {
    framework: result["--framework"],
    target: result["--target"],
    minimum,
    files: result.files,
  };
}

function vitestCases(report, target) {
  requireValue(
    report.success === true &&
      report.numFailedTests === 0 &&
      report.numFailedTestSuites === 0,
    "Vitest did not report a successful suite. Inspect the failed run before repeating or claiming stabilization.",
  );
  const matched = [];
  for (const rawSuite of array(report.testResults, "Vitest testResults")) {
    const suite = object(rawSuite, "Vitest suite");
    requireValue(suite.status !== "failed", "Vitest contains a failed suite.");
    for (const rawTest of array(
      suite.assertionResults,
      "Vitest assertionResults",
    )) {
      const test = object(rawTest, "Vitest test");
      if (test.title !== target && test.fullName !== target) continue;
      requireValue(
        test.status === "passed",
        `Target status is ${test.status}; re-enable and execute the target without skips or retries.`,
      );
      requireValue(
        array(test.failureMessages, "Vitest failureMessages").length === 0,
        "Target still has failure messages. Inspect the report.",
      );
      requireValue(
        test.retryCount === undefined || test.retryCount === 0,
        "Target reports a retry; rerun with retries disabled.",
      );
      matched.push({ name: test.fullName ?? test.title, file: suite.name });
    }
  }
  return matched;
}

function playwrightCases(report, target) {
  const stats = object(report.stats, "Playwright stats");
  requireValue(
    stats.unexpected === 0 &&
      stats.flaky === 0 &&
      array(report.errors, "Playwright errors").length === 0,
    "Playwright reports a failure, flaky result, or runtime error. Inspect the failed run.",
  );
  const matched = [];
  function visit(rawSuite, ancestors) {
    const suite = object(rawSuite, "Playwright suite");
    const titles = [...ancestors, suite.title];
    for (const rawSpec of array(suite.specs, "Playwright specs")) {
      const spec = object(rawSpec, "Playwright spec");
      const fullName = [...titles, spec.title].join(" > ");
      if (spec.title !== target && fullName !== target) continue;
      requireValue(spec.ok === true, "Target spec is not successful.");
      const tests = array(spec.tests, "Playwright tests");
      requireValue(tests.length > 0, "Target spec has no executions.");
      for (const rawTest of tests) {
        const test = object(rawTest, "Playwright test");
        requireValue(
          test.expectedStatus === "passed" && test.status === "expected",
          "Target was skipped, marked as expected failure, or failed; require an ordinary passing target.",
        );
        const results = array(test.results, "Playwright results");
        requireValue(
          results.length === 1,
          "Target has zero or multiple attempts; rerun with --retries=0.",
        );
        const attempt = object(results[0], "Playwright attempt");
        requireValue(
          attempt.status === "passed" && attempt.retry === 0,
          "Target did not pass on its first attempt; inspect failures and rerun with --retries=0.",
        );
        matched.push({
          name: fullName,
          file: spec.file ?? suite.file,
          project: test.projectName,
        });
      }
    }
    for (const child of array(suite.suites ?? [], "Playwright child suites"))
      visit(child, titles);
  }
  for (const suite of array(report.suites, "Playwright suites"))
    visit(suite, []);
  return matched;
}

function verify(config) {
  const paths = new Set();
  const hashes = new Set();
  const reports = [];
  for (const file of config.files) {
    const path = realpathSync(file);
    requireValue(
      !paths.has(path),
      `Duplicate report path: ${file}. Preserve one artifact per run.`,
    );
    paths.add(path);
    const source = readFileSync(path, "utf8");
    const hash = createHash("sha256").update(source).digest("hex");
    requireValue(
      !hashes.has(hash),
      `Duplicate report contents: ${file}. Copies of one report do not establish repeated runs.`,
    );
    hashes.add(hash);
    let report;
    try {
      report = JSON.parse(source);
    } catch {
      throw new Error(
        `Invalid JSON report: ${file}. Select the runner's JSON output, not its console log.`,
      );
    }
    object(report, "report");
    const selected =
      config.framework === "vitest"
        ? vitestCases(report, config.target)
        : playwrightCases(report, config.target);
    requireValue(
      selected.length > 0,
      `Target not found in ${file}. Verify the file filter, quarantine setting, and exact title/full name.`,
    );
    reports.push({
      path,
      sha256: hash,
      selectedTestExecutions: selected.length,
      selected,
    });
  }
  return {
    outcome: "verified-report-artifacts",
    framework: config.framework,
    target: config.target,
    reportsVerified: reports.length,
    selectedTestExecutions: reports.reduce(
      (sum, report) => sum + report.selectedTestExecutions,
      0,
    ),
    retryEvidence:
      config.framework === "playwright"
        ? "Selected executions each report one passing attempt with retry=0; verify runner retry configuration separately."
        : "Vitest JSON may omit retries. Verify runner, per-test and CI retry configuration separately.",
    limitations:
      "Distinct report bytes do not prove independent execution, source revision, artifact provenance, or correctness of the assertions.",
    reports,
  };
}

if (process.argv.slice(2).includes("--help")) {
  console.log(usage);
  console.log(
    "Read-only receipt check. Does not run tests or disable retries. Input reports must be from the intended revision and scope.",
  );
} else {
  try {
    console.log(
      JSON.stringify(verify(options(process.argv.slice(2))), null, 2),
    );
  } catch (error) {
    console.error(`Verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
