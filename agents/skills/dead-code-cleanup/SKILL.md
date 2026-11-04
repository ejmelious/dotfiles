---
name: dead-code-cleanup
description: Audit a TS/React repo for dead code — unused exports, files, deps, assets, and React-specific deadweight (components, props, hooks, routes, styles) — then safely clean up. Use when user asks to find dead/unused code, orphan files, unused deps, repo cleanup, tech-debt reduction, "what can we delete," prune/declutter/shrink a JS/TS repo, or post-migration cleanup. Do NOT use for tree-shaking config or runtime feature flags.
---

# Dead Code Cleanup (TypeScript / React)

This skill audits a TS/React repo for dead code and then safely cleans it up, in that order. **Audit is the default; deletion never happens without explicit user approval and only inside a verifiable, reversible harness.**

Optimize for two outcomes: (1) the user gets a trustworthy *report* of what's dead and why, and (2) when they say "clean it up," nothing breaks and everything is recoverable with one `git` command.

---

## Operating principles

These are non-negotiable:

1. **Read-only by default.** Audit produces a report; nothing is deleted until the user reviews the report and approves a cleanup phase explicitly.
2. **Tools do graph analysis; this skill does judgment.** Defer to `knip` (or `ts-prune` as fallback) and `depcheck` for the hard work of resolving the import graph. Add value in *classification*, *safety*, *React-specific gaps*, and *reporting*.
3. **Never run on a dirty working tree.** If `git status` is not clean, stop and ask the user to commit or stash.
4. **Never push, force-push, rebase, or rewrite history.** Never run `git push`, `git rebase`, `git reset --hard <remote>`, or anything that touches `.git/` directly.
5. **Cleanup happens in a dedicated branch**, in small batches, each as a separate commit, each followed by typecheck + build + test verification. A failing batch is reverted automatically.
6. **High false-positive risk is assumed.** Static analysis cannot see dynamic imports, string-keyed lookups, codegen, or external consumers. Findings are *hypotheses*, not facts, until corroborated.

---

## Phase 0 — Pre-flight

Run these checks before anything else. If any fail, stop and report to the user.

1. **Confirm this is a TS/React repo.** Look for `tsconfig.json` and React in `package.json` dependencies. If it's plain JS or non-React, tell the user this skill is tuned for TS/React and ask if they want to proceed anyway (most heuristics still apply).
2. **Git working tree must be clean.** Run `git status --porcelain`; if non-empty, stop.
3. **Identify the framework and entrypoints** — this is the single most important step. Wrong entrypoints means false "dead" reports for the entire app.
   - **Next.js**: every file under `app/`, `pages/`, `middleware.{ts,js}`, `instrumentation.{ts,js}`, and route handlers is an implicit entrypoint.
   - **Vite / CRA SPA**: `index.html` references `src/main.tsx` (or `src/index.tsx`); that is the single entrypoint.
   - **Remix**: `app/root.tsx`, `app/routes/**`, `app/entry.{client,server}.tsx`.
   - **Library**: `package.json` `main`, `module`, `exports`, `types`, `bin`. Everything reachable from these is public API — **never auto-delete public API**.
   - **Storybook**: every `*.stories.{ts,tsx}` is an entrypoint when Storybook is present.
   - **Tests**: `*.test.{ts,tsx}`, `*.spec.{ts,tsx}` are entrypoints for the test runner.
4. **Detect monorepo layout.** Check `pnpm-workspace.yaml`, `package.json` `workspaces`, `nx.json`, `turbo.json`, `lerna.json`. If present, scope the audit per-package by default and tell the user — cross-package usage is easy to miss.
5. **Detect codegen.** Note any of: `__generated__/`, `*.gen.{ts,tsx}`, `codegen.{yml,yaml,ts}`, Prisma `schema.prisma`, `openapi-typescript`, files whose first non-empty line contains "DO NOT EDIT" or "AUTO-GENERATED". These are **never deleted or edited by this skill** — they regenerate.
6. **Check tool availability.** Verify `knip` and `depcheck` are installable. Prefer the repo's existing versions if present in `devDependencies`; otherwise use `npx -y knip@5` and `npx -y depcheck@1`. If knip refuses to run for any reason, fall back to `ts-prune` and note the reduced confidence in the report.

Write a short summary of the pre-flight findings to `.ai-dev/dead-code-report/00-preflight.md`. Include framework, entrypoints, monorepo layout, codegen directories, and tool versions in use.

---

## Phase 1 — Audit (read-only)

Goal: produce a complete inventory of *suspected* dead code, classified by confidence and grouped by hypothesis. **Do not delete anything in this phase.**

Run these passes. Each writes a report file under `.ai-dev/dead-code-report/`.

### 1a. Unused exports, files, and dependencies — via knip

Generate a `knip.json` if none exists, seeded with the entrypoints detected in Phase 0. Run:

```bash
npx knip --reporter json > .ai-dev/dead-code-report/raw/knip.json
```

Knip output covers: unused files, unused exports, unused exported types, unused dependencies, unlisted dependencies (phantom deps), unused devDependencies, unused binaries, unused class members, duplicate exports. Parse it.

### 1b. Dependencies — corroborate with depcheck

Knip and depcheck disagree often; treat *intersection* as high-confidence and *union minus intersection* as lower confidence.

```bash
npx depcheck --json > .ai-dev/dead-code-report/raw/depcheck.json
```

### 1c. ESLint unused symbols (within-file)

Many repos already have `@typescript-eslint/no-unused-vars` configured. If so, run:

```bash
npx eslint . --format json --rule '{"@typescript-eslint/no-unused-vars": "warn"}' \
  --no-error-on-unmatched-pattern > .ai-dev/dead-code-report/raw/eslint-unused.json || true
```

These are intra-file unused locals, parameters, imports — generally safe, low-stakes findings.

### 1d. Assets

Tools above don't cover `public/`, `src/assets/`, fonts, images, JSON config files. For each asset file, grep for references across `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.scss`, `.html`, `.md`, `.json` using both the basename and the path-from-public-root. Be careful: Next.js public assets are referenced as `/foo.png`, not `public/foo.png`. Write candidates to `.ai-dev/dead-code-report/raw/assets.json`. Default classification for assets is "suspicious" — file references are easy to miss.

### 1e. React-specific passes

Static analyzers miss these, so do them explicitly:

- **Unused components**: components defined and exported but never rendered as JSX anywhere. A component is "rendered" if its name appears in JSX (`<Foo`) or in `React.createElement(Foo, ...)` or as a value passed to `lazy(() => import(...))`, `Route`'s `element`/`component`, or Next.js route file conventions.
- **Unused props**: a prop declared in an interface/type but never destructured or accessed in the component body. Flag, don't delete — props are often part of a component's public contract.
- **Unused hooks**: custom hooks (functions starting with `use`) exported but never called.
- **Dead routes**: route configs (`createBrowserRouter`, `<Route>` JSX, Next.js `app/`/`pages/` files) whose corresponding screen components are otherwise unreachable. Cross-reference with knip's unused files.
- **Styled-components / Emotion / CSS-in-JS**: styled tags assigned to variables that are never used in JSX. Tree-shake-resistant.
- **CSS Modules**: `import styles from './x.module.css'` — every CSS class declared in the file but not referenced via `styles.foo` in TS is dead. Conservative: only flag when *all* classes in a CSS Module are unused.
- **Tailwind safelist conflicts**: if `tailwind.config.{js,ts}` has a `safelist`, those classes are intentionally kept; don't flag.

Write results to `.ai-dev/dead-code-report/raw/react.json`.

### 1f. Dynamic-reference scan (de-risks every other finding)

For each "dead" candidate from 1a–1e, scan the *entire repo* for dynamic references. Mark the finding as **suspicious** (not high-confidence) if any match:

- `import(\`...${symbol or basename}...\`)` — template-literal dynamic imports.
- `require(...)` with a non-literal argument.
- `import.meta.glob(...)` — Vite glob imports often pick up entire directories.
- `require.context(...)` — webpack equivalent.
- String literals matching the symbol name exactly (PascalCase / camelCase identifiers don't tend to appear in unrelated strings, so this is a high-signal grep).
- The symbol or path appears in `*.json`, `*.yml`, `*.yaml`, `*.toml`, `*.md` — could be config, i18n, or docs.
- Route configs from react-router, Next.js routing files, or i18n key files (`locales/*.json`).
- `eval`, `new Function`, or `Function(...)` anywhere in the project.

If any match, downgrade confidence and record *which dynamic pattern matched* in the report — the human needs to see the rationale.

### 1g. Test / story / mock coupling

A `Foo.test.tsx` is dead **iff** `Foo.tsx` is dead. Same for `Foo.stories.tsx`, `Foo.mock.ts`, `__snapshots__/Foo.test.tsx.snap`. Never flag a test file in isolation. Snapshot files without a corresponding test file *are* dead — flag those.

### 1h. Dependency intent classification

For each unused dep candidate from 1a + 1b, classify before reporting:

| Class | Examples | Auto-removable? |
|---|---|---|
| Runtime import | `lodash`, `axios`, `react-query` | Yes, if zero imports |
| Type-only | `@types/node`, `@types/react` | Only if zero `.ts/.tsx` files reference the corresponding runtime lib |
| Plugin-by-name | `eslint-plugin-*`, `babel-plugin-*`, `@tailwindcss/*`, `postcss-*` | No — search configs (`.eslintrc*`, `babel.config.*`, `tailwind.config.*`, `postcss.config.*`) for the name |
| Script-only | tools invoked from `package.json` `scripts` | No — grep `package.json` scripts |
| Build / toolchain | `vite`, `webpack`, `typescript`, `tsx`, `jest`, `vitest` | No — assumed live |
| Peer dependency | declared in `peerDependencies` | Never auto-remove from libraries |
| Husky / git hooks | `husky`, `lint-staged`, `commitlint` | No |
| Framework-implicit | `react`, `react-dom`, `next` | No |

Anything that isn't "Runtime import" with zero references is **suspicious**, not high-confidence.

### 1i. Confidence rubric

For each finding, assign a confidence:

- **High** — knip flagged it AND no dynamic-reference pattern matches AND not in an allowlist AND not in a public-API entrypoint AND (for deps) class is "Runtime import" with zero imports.
- **Medium** — knip flagged it AND one minor caveat (e.g., a string match exists but in a comment, or the dep is plugin-class but not found in configs).
- **Low / Suspicious** — multiple caveats, dynamic-reference match, asset, public API surface, recently authored file (mtime within last 14 days — could be WIP).

### 1j. Group by hypothesis

In the final report, *do not* present a flat list. Group findings as:

- **Truly orphaned** (high confidence, old, no caveats) — top of the report.
- **Possibly work-in-progress** (recently committed, no consumers yet) — ask the user.
- **Likely deprecated** (`@deprecated` JSDoc tag, `legacy/` directory, etc.) — mark, usually keep.
- **Dynamic-reference risk** (caveats found) — needs human eyes.
- **Public API surface** (library exports) — explicitly keep unless user confirms.

---

## Phase 2 — Report

Write a single human-facing summary to `.ai-dev/dead-code-report/SUMMARY.md`. Structure:

```markdown
# Dead Code Audit — <date>

## Headline numbers
- Unused files: N (M high-confidence)
- Unused exports: N
- Unused dependencies: N (M high-confidence)
- Unused assets: N
- React-specific findings: N
- Estimated LOC removable: N
- Estimated dep count reduction: N

## Truly orphaned (recommended for removal)
<grouped list with file path, kind, why we're confident, what tool flagged it>

## Possibly work-in-progress
<list>

## Likely deprecated (review, usually keep)
<list>

## Dynamic-reference risk (manual review required)
<list with the specific dynamic pattern that matched>

## Public API surface (will not auto-remove)
<list>

## Excluded by allowlist
<list>
```

Inline in the conversation, surface **only**: the headline numbers, the path to the summary file, and a one-line prompt asking the user to review and choose which categories to act on. Do not dump the lists into the conversation — the report file is the deliverable, the chat is the interface.

---

## Phase 3 — Cleanup (only with explicit user approval)

The user must explicitly approve cleanup, and may scope it (e.g., "clean up the truly-orphaned and unused deps, leave the rest"). Then:

### 3a. Safety harness

1. Re-verify `git status` is clean.
2. Create a branch: `git checkout -b chore/dead-code-cleanup-$(date +%Y%m%d)`.
3. Confirm the project's verification commands. Default to: `tsc --noEmit`, the `build` npm script (if present), the `test` npm script (if present), and `lint` (if present). Ask the user to confirm or override.
4. Run all verification commands once *before* any changes to establish a baseline — if the repo doesn't build clean already, stop. You cannot detect regressions from a broken baseline.

### 3b. Batching order (smallest blast radius first)

Execute in this order. Each batch is a separate commit. After each batch, run all verification commands. **If any verification command fails, `git revert HEAD --no-edit` that batch and continue with the next** — log the reverted batch in the report.

1. **Unused devDependencies** (lowest risk — affects only the build).
2. **Unused dependencies** (runtime imports only, high-confidence class).
3. **Unused assets** (one commit per asset directory, or grouped if small).
4. **Orphan files** (whole files with no importers).
5. **Unused exports** within otherwise-used files.
6. **Unused intra-file symbols** (locals, imports, parameters).

Skip suspicious / low-confidence categories entirely in automated cleanup. They go in a follow-up section of the final report for human review.

### 3c. Commit hygiene

Each commit message follows: `chore(dead-code): remove <N> <kind>` with a body listing the affected paths. This keeps the history bisectable — if something breaks downstream weeks later, `git bisect` will land on a single category.

### 3d. Verification semantics

A batch passes only if every verification command exits 0. If `tsc --noEmit` previously emitted warnings, capture the baseline count; passing means "no new errors," not "zero errors."

### 3e. Forbidden operations

Never, under any circumstance, in this phase:

- `git push` (any form)
- `git rebase`
- `git reset --hard` to anything outside this branch's recent commits
- `git filter-branch`, `git filter-repo`
- Edits to files in codegen directories (Phase 0 list)
- Edits to files containing "DO NOT EDIT" / "AUTO-GENERATED" headers
- Deletion of any file matching `peerDependencies` from the root `package.json`

---

## Phase 4 — Post-cleanup report

Write `.ai-dev/dead-code-report/RESULT.md`:

- Batches attempted, batches landed, batches reverted (with reason).
- Before/after LOC (`git ls-files | xargs wc -l`).
- Before/after file count.
- Before/after dependency count (`jq '.dependencies | length' package.json`, same for devDependencies).
- If a `build` script exists, before/after build output size (run build twice, compare `dist/` or `.next/` sizes via `du -sb`).
- Branch name, commit range.
- Reminder to the user that nothing has been pushed; they own the merge.

Surface inline: the headline deltas and the branch name. Done.

---

## Allowlist file

If `.dead-code-ignore` exists in the repo root, honor it. Format: one path or glob per line, `#` for comments. Paths matching an entry are excluded from all phases. Recognize these implicit allowlist entries even without the file:

- `**/*.d.ts` (ambient types, often consumed externally)
- Anything under `codegen` directories from Phase 0
- Anything imported by `package.json` `exports` or `main` in a library project

If the file doesn't exist and the user wants exemptions, offer to create one with the entries they specify.

---

## When you finish

Always end with:

1. Path to `.ai-dev/dead-code-report/SUMMARY.md` (and `RESULT.md` if cleanup ran).
2. Branch name (if cleanup ran).
3. The one-liner the user needs to roll back everything: `git checkout <previous-branch> && git branch -D <cleanup-branch>`.
4. A short note on what *was not* touched and why — suspicious findings, dynamic-reference risks, public API. The director of engineering wants to know the surface area of remaining debt, not just what got cleaned.
