## TypeScript review — <PR #n title, or branch name>

**Result:** 🔴 <n> Critical · 🟠 <n> High · 🟡 <n> Medium · ⚪ <n> Low
**Action taken:** ✅ <n> fixed (<n> commits) · ✋ <n> need you · ↩️ <n> reverted

<One or two sentences: the overall verdict and the most important thing to know.>

### 🔴🟠 Critical & High — what was done

| | ID | Severity | What was wrong | What was done | Commit | Verified |
|---|---|---|---|---|---|---|
| ✅ | TS-01 | 🔴 Critical | Webhook body cast to `Order` without checking (`src/api/orders.ts:42`) | Validate the payload; reject bad input | `abc1234` | New test failed before, passes now |
| ✋ | TS-04 | 🟠 High | <one line> (`path:line`) | Not fixed: <reason>. Recommended: <fix> | — | — |

<If there are no Critical/High findings, replace the table with: "None found. No code was changed.">

> ⚠️ **Changes callers must know about:** `handleWebhook` now returns `Promise<string>` (TS-02); every caller in this repo was updated to `await` it.

<Omit the ⚠️ line if no signature or behaviour change is visible to callers.>

#### ✅ TS-01 · 🔴 Critical — <short title>
- **Where:** `src/api/orders.ts:42`
- **What was wrong:** <what the code did>
- **What could happen:** <input → wrong outcome>
- **What was done:** <the change and why this approach over the alternatives>
  ```diff
  - const order = JSON.parse(body) as Order;
  + const order = parseOrder(JSON.parse(body)); // throws on invalid shape
  ```
- **Verified:** <new test that failed before and passes now / typecheck / lint / tests vs baseline>
- **Commit:** `abc1234`, revertable on its own
- **Rule:** ET #<n> <title> / <pitfall name>

<One block per Critical/High finding, in table order. For ✋ and ↩️ findings, replace "What was done" with "Why not fixed here" and "Recommended fix"; for ↩️ also say what failed.>

### Verification

| Check | Before | After |
|---|---|---|
| Typecheck (`<command>`) | <pass / n errors> | <pass / n errors> |
| Lint (`<command>`) | … | … |
| Tests (`<command>`) | … | … |

<Anything not verified, said plainly.>

**Scope:** <n> TypeScript files changed (<base>…<head>). TypeScript <version>; strict: <on/off>; notable flags: <noUncheckedIndexedAccess, …>.

---

### Not changed — your call

#### 🟡 Medium

- **TS-05** `path:line` — <problem>. <Suggestion>. (<rule>)

#### ⚪ Low

- **TS-08** `path:line` — <one line>. (<rule>)

#### Pre-existing (not rated, not changed)

- `path:line` — <one line>. <Omit the section if empty.>
