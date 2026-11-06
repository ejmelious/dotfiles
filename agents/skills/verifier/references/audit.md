# Audit — map a repo against the ladder

Input: a repo, package, or service. Output: what verifiers exist at each rung, the exact command for each, whether each meets the bar, and the gaps that matter most. Report-only; ends by offering to build the top gaps.

## 1. Scope

Default to the current repo. If the user names a package, service, or squad area, restrict to the paths that cover it — and say what you left out.

## 2. Discover, don't assume

Read the repo for each rung. Places to look:

- **Types / lint / architecture:** `tsconfig*.json` strictness flags; ESLint/Biome config and any custom rules (local plugins, `eslint-rules/`); dependency-cruiser, Nx module boundaries, Semgrep, import restrictions.
- **Unit / property:** test runners and config (`vitest`, `jest`, `pytest`); property libraries (`fast-check`, `hypothesis`) and whether they're actually used.
- **Golden / snapshot:** fixture directories, `__snapshots__`, approval-test helpers.
- **Contract:** Pact files, recorded vendor payloads, OpenAPI/GraphQL schema checks.
- **E2E / browser:** Playwright/Cypress config and specs; preview-environment workflows.
- **Shadow / load / mutation / evals:** dual-run helpers, k6 or Gatling scripts, Stryker config, eval suites.
- **Canary / synthetics / rollout:** monitor or synthetic definitions kept in the repo (Terraform, Datadog config), feature-flag and rollout tooling.
- **Where they run:** CI workflows (which jobs run on PR vs merge vs schedule), git hooks (husky, lefthook, pre-commit), and agent hooks (`.claude/settings.json`, Codex config).

Run the fast commands once (typecheck, lint, unit tests) to record whether they pass and how long they take. Don't run slow or environment-dependent ones (load, e2e against shared environments) — record their commands and where they run.

If past escapes are visible — `fix:` commits, incident links in PRs, or incidents/tickets the user gave you — note which areas they cluster in. They weight the gaps.

## 3. Check each verifier against the bar

**First check it actually runs.** A configured verifier that can't execute is worth nothing and looks like coverage. Look for what breaks it before its first assertion: CI that installs with `npm ci` but no lockfile is committed; a lint config with no parser for the files it targets (ESLint without a TypeScript parser on `.ts`); a test glob that matches no files; a job gated off for the events that matter (`if: github.event_name == 'push'`). Count a verifier that can't run as missing, and say why.

Then, for each verifier found, check the bar from SKILL.md: can an agent run it in one command; does it gate (hook/CI) or only advise; do its failures teach the fix; is it flaky, skipped, or muted; is it protected. A test suite with 40 skipped tests or a lint rule set to `warn` is a weaker rung than it looks — say so.

## 4. Rank the gaps

A gap is a rung the repo needs but doesn't have, or has too weakly. Rank by risk: blast radius of the area, past escapes there, and data sensitivity. Not every repo needs every rung — a library with no service needs no canary. Say which rungs you consider not needed and why.

Name the **top two gaps**, each with a short proposal in the format from `escape-analysis.md` §4 (rung, assertion, where it runs, owner).

## 5. Write the report

Write `.ai-dev/verifiers/ladder-audit.md`:

```markdown
# Verifier Ladder Audit — <repo / scope>
## Scope — what was covered and what wasn't
## Inventory
| Rung | Verifier | Command | Runs (hook / PR / nightly / rollout) | Runtime | Meets bar? (why not) |
## Past escapes — where they cluster (if known)
## Gaps — ranked, with reason
## Top two — proposals
## Not needed — rungs this scope doesn't need, with reason
```

The inventory table is also what `implementation-plan-builder` and `implementation-plan-executor` read, so keep commands exact and runnable from the repo root.
