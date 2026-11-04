# TypeScript pitfalls and anti-patterns

Gotchas a reviewer should know beyond Effective TypeScript, drawn from the
TypeScript handbook, tsconfig reference and FAQ, typescript-eslint, and
practitioners (Matt Pocock / Total TypeScript, Josh Goldberg / Learning
TypeScript, Basarat / TypeScript Deep Dive, Stefan Baumgartner, Titian
Cernicova-Dragomir). Each entry: what to look for, why it bites, a default
severity, and the related lint rule or ET item. Sources are at the end.

Default severities are starting points; rate by consequence in the code at
hand.

## Contents

1. Trust boundaries (external data)
2. Promises and async
3. Lies to the compiler
4. Narrowing and control flow
5. Unsoundness the compiler allows by design
6. Type design anti-patterns
7. Generics, overloads, callbacks
8. tsconfig flags that change what counts as a bug
9. Modules and emit
10. React + TypeScript
11. Where experts disagree
12. Sources

---

## 1. Trust boundaries (external data)

**P-BOUNDARY-ASSERT: external data asserted, not validated.** `JSON.parse`,
`res.json()`, `req.body`, `localStorage`, `postMessage`, env vars, queue
messages and untyped library results are `any` or `unknown`. `as T`, a
`: T` annotation on an `any`, or a return-only generic (`res.json<T>()`,
`get<T>()`) turns unchecked data into "trusted" types. Every type downstream
is then fiction: missing fields become `undefined`, numbers arrive as
strings, and `NaN` or crashes show up far from the cause.
- **Critical** when the data drives money, auth, persistence or other
  irreversible effects; **High** otherwise.
- Fix: validate at the boundary with the repo's schema library (zod,
  valibot, io-ts, ajv…) and derive the type from the schema. With no
  library, take `unknown` and narrow with a guard that checks every field
  the code relies on. Keep the validation in one function (ET #45, #46, #74).
- Lint: `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-return`,
  `no-unsafe-argument`.

```ts
// bad
const order = JSON.parse(body) as Order;
// good
const order = OrderSchema.parse(JSON.parse(body)); // or parseOrder(unknown): Result<Order>
```

**P-EXTRA-PROPS-LEAK: structural typing lets extra fields through.** A value
typed `PublicUser` can still carry `passwordHash` at runtime if it came from a
wider object. Spreading it into a response, a log line, or a DB write leaks
the extra fields. **High** when the data is sensitive or persisted; pick
fields explicitly (ET #4).

## 2. Promises and async

**P-FLOATING-PROMISE.** A promise that is never awaited, returned or given a
`.catch`: failures vanish (or crash the process as unhandled rejections), and
code after it runs before the work finishes. `void promise` silences the lint
rule but changes nothing at runtime — acceptable only when fire-and-forget
is intended *and* the promise has its own error handling.
- **Critical** on write paths (saves, payments, emails, audit logs); **High**
  elsewhere. Lint: `no-floating-promises`.

**P-ASYNC-IN-VOID-SLOT: async callbacks where the return is ignored.**
`arr.forEach(async …)`, `addEventListener('x', async …)`, React
`onClick={async () => …}`, `setTimeout(async …)`, emitters. TypeScript allows
it because a `() => void` slot accepts any return. The caller doesn't wait, so
"all done" happens before the work, and rejections are lost. Also: `if
(promise)` is always truthy; `arr.filter(async …)` keeps everything.
- **Critical** when completion or errors matter (refunds, writes);
  **High** otherwise. Lint: `no-misused-promises`.
- Fix: `await Promise.all(items.map(async …))` (or a `for…of` loop with
  `await` when order or rate limits matter); in handlers,
  `() => { save().catch(report); }`.

**P-RETURN-AWAIT-IN-TRY.** `try { return promise; } catch {}` — without
`await`, a rejection skips the `catch`. **High.** Lint: `return-await`.

**P-AWAIT-NON-THENABLE.** `await` on a non-promise usually means an API was
misunderstood (sync vs async). **Medium.** Lint: `await-thenable`.

**P-CATCH-ANY.** `catch (e: any) { e.message }` or `.catch((e) => e.response.status)`.
Anything can be thrown (strings, `undefined`, objects); `e.message` then
crashes inside the error handler or logs `undefined`. **High.**
- Fix: leave `e` as `unknown` (`useUnknownInCatchVariables`, part of
  `strict`) and narrow: `e instanceof Error ? e.message : String(e)`.
- Lint: `use-unknown-in-catch-callback-variable`, `no-unsafe-member-access`.
- Related: throwing non-`Error` values loses stacks (`only-throw-error`,
  `prefer-promise-reject-errors`), **Medium**.

## 3. Lies to the compiler

**P-AS-ASSERTION.** `x as T` only checks that the types overlap; `{} as T`
compiles with every required field missing and keeps compiling as `T` grows.
`as unknown as T` / `as any as T` skip even that. **High** (Critical at a
trust boundary, see §1); **Medium** for object literals where an annotation or
`satisfies` would do. ET #9.

**P-NON-NULL.** `x!` removes `null`/`undefined` with no runtime check: classic
with `Map.get`, `Array.find`, `document.querySelector`, `useRef().current`,
optional chains. Crashes later with an unhelpful `TypeError`. **High.**
Fix: handle the missing case (throw a descriptive error, return a fallback,
or change the type so it can't be missing). Lint: `no-non-null-assertion`.

**P-LYING-GUARD: type predicates and assertion functions that don't prove
their claim.** The compiler trusts `x is T` and `asserts x is T` blindly. A
guard that checks one field (or a field every member has) narrows to the
whole type. **High**; **Critical** if it guards external input or picks a
pricing/permission branch. Fix: check the property that actually
distinguishes the type, or derive the guard from a schema. ET #22.

```ts
// bad: every CartItem has sku, so this is always true
const isPromo = (i: CartItem): i is PromoItem => 'sku' in i;
// good
const isPromo = (i: CartItem): i is PromoItem =>
  'promoPriceCents' in i && typeof i.promoPriceCents === 'number';
```

**P-TS-IGNORE.** `@ts-ignore` and `@ts-nocheck` hide errors forever; they
never report when the problem goes away or a new one appears on the same
line. **High** for new ones. `@ts-expect-error` is better (it fails when no
longer needed) but needs a reason; **Medium** without one. Lint:
`ban-ts-comment`. (Josh Goldberg)

**P-RETURN-ONLY-GENERIC.** `function get<T>(key: string): T` lets every caller
pick a type — a cast in disguise. **High** when the value is external;
otherwise Medium. Fix: take a schema/decoder parameter, or return `unknown`.
ET #51; lint `no-unnecessary-type-parameters`.

**P-UNNECESSARY-ASSERTION.** An `as`/`!` that changes nothing hides intent and
becomes a real lie after the next edit. **Low.** Lint:
`no-unnecessary-type-assertion`.

## 4. Narrowing and control flow

**P-NON-EXHAUSTIVE.** `switch`/if-chains over a union with a silent `default`
(or no default) mean a new member compiles and is ignored. When the union
grew in this PR and a handler wasn't updated, that's a live bug.
- **Critical** if a member added in this change is now silently dropped on
  a path that matters; **High** for a missing exhaustiveness check on a
  union that will grow (actions, events, statuses).
- Fix: handle the case, and end with
  `default: { const unhandled: never = x; throw new Error(...) }`
  (or `assertNever`). A `default` is legitimate when values can arrive from
  outside the union (old clients, servers) — then log/handle explicitly.
- ET #59; lint `switch-exhaustiveness-check` (note: by default a `default`
  clause does not count as exhaustive for unions).

**P-TRUTHINESS-ZERO.** `if (count)`, `opts.limit || 50`, `name && …` treat `0`,
`""` and `NaN` as missing; type-correct, so `tsc` is silent. **High** when
`0`/`""` are valid values (quantities, prices, offsets). Fix: `!= null`, `??`.
Lint: `prefer-nullish-coalescing`, `strict-boolean-expressions`.

**P-TYPEOF-NULL.** `typeof x === 'object'` admits `null` (and arrays). **High**
in guards for external data.

**P-STALE-NARROWING.** TypeScript keeps a property narrowed after a function
call that may mutate it (`if (s.status === 'open') { close(s); s.status … }`).
**Medium**; **High** in stateful code. Re-check after the call. (Learning
TypeScript)

**P-INCLUDES-CAST.** `ROLES.includes(s as Role)` to satisfy `includes` on an
`as const` array — an unchecked cast, and `s` still isn't narrowed. **Medium.**
Fix: a small guard `isRole(s): s is Role` using `(ROLES as readonly string[]).includes(s)`.
(Stefan Baumgartner)

**P-KEYS-CAST.** `Object.keys(o) as (keyof T)[]` or `for…in` assuming the keys;
extra runtime keys make this index things that don't exist. **Medium.**
ET #60.

## 5. Unsoundness the compiler allows by design

TypeScript explicitly doesn't aim for soundness (design goals). Flag these
even though they compile:

- **Unchecked index access** (without `noUncheckedIndexedAccess`):
  `arr[i].x`, `record[key].y` are typed as present. **High** when the key
  can miss.
- **Array covariance:** a `Dog[]` passed as `Animal[]` can have a `Cat`
  pushed into it. **High** when the callee mutates; fix with
  `readonly Animal[]` parameters.
- **Method-syntax bivariance:** `interface H { handle(x: A | B): void }` is
  checked loosely even under `strictFunctionTypes`; property syntax
  `handle: (x: A | B) => void` is checked strictly. **Medium.**
- **Optional vs `undefined`:** `prop?: T` accepts an explicit `undefined`
  unless `exactOptionalPropertyTypes`; spreads like `{ ...defaults, theme:
  undefined }` wipe defaults. **High** in PATCH/merge code, Medium elsewhere.
- **Excess property checks only on fresh literals:** a misspelled field on
  an object built in a variable passes. **Medium.** Use `satisfies T` on the
  literal. ET #11.
- **Assertions, `!`, `any`, trusted predicates** — see §3.

## 6. Type design anti-patterns

**P-OPTIONAL-BAG.** `{ status: string; data?: T; error?: string; loading?: boolean }`
instead of a discriminated union: impossible states compile and `!` spreads.
**Medium**; **High** if the code already reads an impossible combination.
ET #29, #34, #37.

**P-STRING-FOR-UNION.** `status: string` where the set of values is known.
Typos compile. **Medium** (High if a typo would silently misbehave). ET #35.

**P-ENUM.** New enums, especially numeric ones: numeric enums accept other
numbers in places, have reverse mappings (double `Object.keys`), string enums
reject equivalent literals, enums emit runtime code, `const enum` breaks
under `isolatedModules`, and `erasableSyntaxOnly` / Node type stripping
reject them entirely. **Medium** for a new enum; don't flag existing ones in
untouched code. Prefer a literal union or an `as const` object. ET #72.

**P-WRAPPER-AND-EMPTY-TYPES.** `Function` (untyped calls returning `any`),
`{}` (means "any non-nullish value", primitives included — not "empty
object"), `Object`, `String`, `Number`. **High** for `Function`/`{}` as
parameter types; **Low** for wrapper primitives. Fix: a real function
signature; `object`, `Record<string, unknown>` or `unknown`; lowercase
primitives. Lint: `no-unsafe-function-type`, `no-empty-object-type`,
`no-wrapper-object-types`. (The user's repo convention: `Record<string, never>`
for an empty object type.)

**P-SAME-TYPE-PARAMS.** `(fromId: string, toId: string)`, `(cents, percent, floor)`
— callers can swap them silently. **Medium**; options object or branded types.
ET #38, #64.

**P-UNBRANDED-IDS-UNITS.** Different ID kinds or units (cents vs dollars) that
are the same structural type. **Medium**; **High** where a mix-up exists or
would move money. Brands need a checked constructor. ET #64.

**P-MUTATING-INPUT.** Functions that mutate arrays/objects they were given
(sort in place, push, delete). **Medium**; **High** if callers' data is
shared (React state, caches). `readonly` parameters and `toSorted`. ET #14.

## 7. Generics, overloads, callbacks

- **Type parameter used once** (`<T>(x: T): void`): adds nothing. **Low–Medium.** ET #51.
- **Over-constrained generic** (`T extends any[]` where `T` works): infers
  worse. **Low.**
- **Overloads that reject unions:** separate overloads for `string` and
  `string[]` reject `string | string[]`; general overload listed first
  shadows specific ones. **Medium.** ET #52.
- **Callback types in APIs:** use `void` (not `any`) for ignored returns;
  don't make callback parameters optional unless they really may be absent;
  don't overload on callback arity. **Medium.** (Handbook Do's and Don'ts)
- **`unbound-method`:** passing `obj.method` as a callback loses `this`.
  **High.**

## 8. tsconfig flags that change what counts as a bug

Read the project's flags first (SKILL.md step 2). A PR that **loosens** any of
these needs a reason:

| Flag | What turning it off hides | Severity if loosened in the PR |
|---|---|---|
| `strict` (and its members) | implicit `any`, null crashes, unsound function params, uninitialised class fields, catch as `any` | Critical for `strictNullChecks`/`noImplicitAny`; High for others |
| `noUncheckedIndexedAccess` | `undefined` from index reads | High (if it was on) |
| `exactOptionalPropertyTypes` | absent vs `undefined` confusion | Medium |
| `noImplicitOverride` | accidental overrides, orphaned overrides after a base rename | Medium |
| `verbatimModuleSyntax` / `isolatedModules` | dropped side-effect imports, transpiler mismatches | Medium |
| `noImplicitReturns`, `noFallthroughCasesInSwitch` | missing returns, accidental fallthrough | Low–Medium |

When a flag is **off** in the project, the bug class it would catch is your
job: e.g. without `noUncheckedIndexedAccess`, check index reads by hand.
Recommending a project-wide flag change is a Medium note, never an auto-fix.

## 9. Modules and emit

- **Type-only imports without `import type`** under `verbatimModuleSyntax`
  break; elsewhere they're style (**Low**). Don't flag both
  `consistent-type-imports` and the flag — pick whichever the repo uses.
- **Side-effect import relied on but elided.** **High** when a polyfill or
  registration silently disappears.
- **`export default`** hurts renames and auto-import. **Low**; frameworks
  often require it (routes, pages) — don't flag those.
- **`typescript` / `@types/*` in `dependencies`.** **Low** (Medium for
  published packages). ET #65.

## 10. React + TypeScript

- **Async handlers in props** (`onClick={async () => …}`): rejections lost —
  see P-ASYNC-IN-VOID-SLOT.
- **`useState({} as User)`**: a lie; fields read before set crash. **High.**
  Use `useState<User | null>(null)`.
- **`useState([])`** infers `never[]` in some setups; pass the element type. **Low.**
- **`ref.current!`**: see P-NON-NULL; check for `null`. **Medium–High.**
- **Event types:** type separate handlers with `React.ChangeEvent<HTMLInputElement>`
  etc.; read `e.currentTarget`. Casting `e.target as HTMLInputElement` is
  **Medium**.
- **Reducers:** actions as a discriminated union plus exhaustiveness
  (P-NON-EXHAUSTIVE).
- **`React.FC`:** don't flag. Since TS 5.1 / React 18 it's fine; props
  annotation is a preference.

## 11. Where experts disagree

Don't present these as rules; follow the repo's convention, and mention the
alternative at most as Low.

- **Annotate vs infer.** Pocock: rely on inference, use `satisfies` for
  literal tables. Titian Cernicova-Dragomir / `isolatedDeclarations`:
  explicit types on exports help builds. ET #18: don't annotate inferable
  locals, do annotate exported return types where it helps. The user's own
  rule file asks for explicit parameter and return types — so treat missing
  return types on *exported* functions as Low, and never flag explicit
  annotations as wrong unless they widen a type (losing literal keys) —
  that's Medium (P-ANNOTATION-WIDENS).
- **Enums.** Pocock: avoid in new code; if needed, string enums with explicit
  values or `as const` objects. Baumgartner: plain unions, not `as const`
  objects.
- **`type` vs `interface`.** ET 2nd ed. leans to `interface` for object
  shapes; Baumgartner prefers `type`. Consistency is what matters.
- **`default` in exhaustive switches.** Lint treats it as non-exhaustive by
  default; it's correct when values can arrive from outside the union.
- **Extra strict flags.** Pocock calls `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `noUnused*` noisy; the handbook is neutral.

## 12. Sources

- TypeScript handbook: Do's and Don'ts — https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html
- Handbook: More on Functions — https://www.typescriptlang.org/docs/handbook/2/functions.html
- Handbook: Narrowing — https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Handbook: Type Compatibility (soundness) — https://www.typescriptlang.org/docs/handbook/type-compatibility.html
- TSConfig reference — https://www.typescriptlang.org/tsconfig/
- TypeScript FAQ — https://github.com/microsoft/TypeScript/wiki/FAQ
- TypeScript design goals — https://github.com/microsoft/TypeScript/wiki/TypeScript-Design-Goals
- typescript-eslint configs and rules — https://typescript-eslint.io/users/configs/ , https://typescript-eslint.io/rules/
- Total TypeScript (Matt Pocock): enums, `satisfies`, tsconfig cheat sheet, React.FC, ts-reset — https://www.totaltypescript.com/
- Learning TypeScript (Josh Goldberg): comment directives, branded types, narrowing, void assignability — https://www.learningtypescript.com/articles/
- TypeScript Deep Dive (Basarat): assertions, discriminated unions, export default — https://basarat.gitbook.io/typescript/
- Stefan Baumgartner: `Array.includes`, iterating objects, avoid enums — https://fettblog.eu/ , https://oida.dev/
- Titian Cernicova-Dragomir: isolated declarations — https://gitnation.com/contents/accelerating-typescript-builds-harnessing-parallelism-and-isolated-declarations
- React TypeScript Cheatsheet — https://react-typescript-cheatsheet.netlify.app/
