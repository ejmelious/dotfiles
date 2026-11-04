# Effective TypeScript — reviewer's map

Item numbers and titles are from the **2nd edition** (Dan Vanderkam, O'Reilly,
2024; 83 items), verified against the table of contents in the author's repo
(github.com/danvk/effective-typescript). 1st-edition numbers differ — always
cite 2nd-edition numbers as `ET #<n> <title>`. The "look for" notes are a
reviewer's summary, not the book's text; read the book for the reasoning.

Default severities are starting points. Rate by consequence in the code at
hand (see SKILL.md, step 4).

## Contents

1. Escaping the type system (`any`, assertions, unsoundness)
2. Type design: make invalid states unrepresentable
3. Narrowing, inference and control flow
4. Runtime vs. type space
5. Generics and type-level code
6. Recipes worth asking for
7. API surface and declarations
8. Hygiene and style
9. Rarely review-relevant

---

## 1. Escaping the type system

Most Critical and High findings live here: places where the code tells the
compiler something it can't check.

| Item | Look for | Default |
|---|---|---|
| ET #5 Limit Use of the `any` Type | Every new `any`. Ask what it should be instead; an `any` silently disables checking for everything it touches. | High |
| ET #43 Use the Narrowest Possible Scope for `any` Types | An unavoidable `any` on a variable, parameter or return type instead of one expression; `any` returned from a function spreads to all callers. | High |
| ET #44 Prefer More Precise Variants of `any` to Plain `any` | `any` where `unknown[]`, `Record<string, unknown>` or a function type with `unknown` would keep some checking. | Medium |
| ET #46 Use unknown Instead of `any` for Values with an Unknown Type | `any` on untrusted input: `JSON.parse`, `catch` variables, message events, third-party responses. Use `unknown` and narrow. | High → Critical at a trust boundary |
| ET #9 Prefer Type Annotations to Type Assertions | `x as T` where `const x: T = …` or `satisfies T` would catch a mistake. An assertion only checks that the types overlap. | High when the value comes from outside; Medium for literals |
| ET #45 Hide Unsafe Type Assertions in Well-Typed Functions | Casts repeated at call sites instead of inside one small function with an honest signature. | Medium |
| ET #48 Avoid Soundness Traps | Known holes: unchecked index access (without `noUncheckedIndexedAccess`), mutable array covariance, method-parameter bivariance, narrowing invalidated by a callback or mutation, optional properties vs. `undefined`. | High when a plausible input hits it |
| ET #42 Avoid Types Based on Anecdotal Data | Hand-written interfaces for external APIs, written from a sample payload. Prefer types generated from the spec/schema. | Medium; High if fields are clearly guessed |
| ET #49 Track Your Type Coverage to Prevent Regressions in Type Safety | `any` arriving from dependencies (untyped libs, `@types` gaps) into the change. | Medium |

## 2. Type design: make invalid states unrepresentable

These turn into Critical/High only when the change already mishandles the
invalid state; otherwise they are design feedback (Medium).

| Item | Look for | Default |
|---|---|---|
| ET #29 Prefer Types That Always Represent Valid States | Flags and fields that can contradict each other (`isLoading` + `error` + `data` all optional). Suggest a tagged union. | Medium; High if code reads an impossible combination |
| ET #34 Prefer Unions of Interfaces to Interfaces with Unions | An interface whose union-typed fields actually vary together. | Medium |
| ET #37 Limit the Use of Optional Properties | New optional properties, especially config options whose absence changes behaviour silently. | Medium |
| ET #33 Push Null Values to the Perimeter of Your Types | Several related fields each nullable, forcing null checks everywhere; make the whole object nullable instead. | Medium |
| ET #32 Avoid Including `null` or `undefined` in Type Aliases | `type User = {...} \| null`; keep nullability at the use site so readers see it. | Low |
| ET #35 Prefer More Precise Alternatives to String Types | `string` where a literal union, template literal type or `keyof T` would catch typos. | Medium; High if a typo would compile and misbehave |
| ET #36 Use a Distinct Type for Special Values | In-band sentinels (`-1`, `""`, `0`) for "not found"/"none". | High when a sentinel can flow into arithmetic or lookups |
| ET #38 Avoid Repeated Parameters of the Same Type | Adjacent parameters of the same type (`(from: string, to: string)`, `(width: number, height: number)`) that callers can swap. Options object or branded types. | Medium |
| ET #64 Consider Brands for Nominal Typing | IDs, units, or validated strings of the same structural type that must not mix (`UserId` vs `OrgId`, cents vs dollars). | Medium; High where a mix-up has already happened or would cost money |
| ET #30 Be Liberal in What You Accept and Strict in What You Produce | Return types that are loose unions or optional-heavy, pushing checks onto every caller; parameters that are needlessly narrow. | Medium |
| ET #40 Prefer Imprecise Types to Inaccurate Types | Clever types that are wrong for some inputs (reject valid values or accept invalid ones). | Medium; High if they accept invalid values at a boundary |
| ET #39 Prefer Unifying Types to Modeling Differences | Near-duplicate types (snake_case vs camelCase copies) maintained by hand. | Medium |
| ET #16 Prefer More Precise Alternatives to Index Signatures | `{[k: string]: T}` where the keys are known, or a `Map` fits. | Medium |
| ET #17 Avoid Numeric Index Signatures | `{[i: number]: T}`; use arrays, tuples, `ArrayLike`. | Low |
| ET #14 Use `readonly` to Avoid Errors Associated with Mutation | Functions that mutate inputs they don't own; shared config/constant arrays without `readonly`/`as const`. | Medium; High if a caller's data is mutated unexpectedly |
| ET #41 Name Types Using the Language of Your Problem Domain | Vague names (`Data`, `Info`, `Obj`). | Low |

## 3. Narrowing, inference and control flow

| Item | Look for | Default |
|---|---|---|
| ET #22 Understand Type Narrowing | Narrowing that doesn't do what the author thinks: `typeof x === "object"` includes `null`; truthiness checks drop `0`/`""`; user-defined type guards whose body doesn't prove the claim. | High; Critical when a lying guard admits bad data |
| ET #23 Be Consistent in Your Use of Aliases | Checking `obj.prop` then using a different alias (or re-reading after an `await`/callback) so the narrowing doesn't hold. | Medium |
| ET #20 Understand How a Variable Gets Its Type | Unwanted widening (`let` literals becoming `string`), objects that lose literal types; suggest `as const` or `satisfies`. | Low–Medium |
| ET #24 Understand How Context Is Used in Type Inference | Values extracted from their context lose tuple/literal types and then need casts. | Low |
| ET #18 Avoid Cluttering Your Code with Inferable Types | Redundant annotations on locals. Keep explicit return types on exported functions and wherever they document intent or catch errors early. | Low |
| ET #19 Use Different Variables for Different Types | One variable reused for values of different types. | Low |
| ET #21 Create Objects All at Once | Objects built property by property, forcing `{} as T` or optional fields. | Medium if it needs a cast |
| ET #25 Understand Evolving Types | Variables starting as `[]`/`null` whose evolved type isn't what's intended. | Low |
| ET #26 Use Functional Constructs and Libraries to Help Types Flow | Hand-rolled loops that need annotations or casts where `map`/`filter`/`Object.fromEntries` would infer. | Low |
| ET #27 Use async Functions Instead of Callbacks to Improve Type Flow | Callback- or `.then`-style code that would be clearer and better-typed as `async`/`await`. | Low–Medium |

## 4. Runtime vs. type space

| Item | Look for | Default |
|---|---|---|
| ET #3 Understand That Code Generation Is Independent of Types | Code that expects types to exist at runtime (`instanceof` on an interface, checking a type alias), or type-only constructs expected to validate data. | High |
| ET #74 Know How to Reconstruct Types at Runtime | Runtime validation hand-written separately from the static type so the two can drift; derive one from the other (zod/valibot schema → `z.infer`, codegen). | Medium; High if they already disagree |
| ET #8 Know How to Tell Whether a Symbol Is in the Type Space or Value Space | `typeof` used in the wrong space, class/enum used as both without realising. | Low–Medium |
| ET #4 Get Comfortable with Structural Typing | Code that assumes an object has *only* its declared properties (`Object.keys` iteration, spreading into a DB write, serialising to an API). Extra props are always possible. | High when extra fields leak to storage/output |
| ET #11 Distinguish Excess Property Checking from Type Checking | Relying on excess-property errors for safety; they only fire on fresh object literals. | Medium |
| ET #72 Prefer ECMAScript Features to TypeScript Features | Enums (esp. numeric), namespaces, parameter properties, experimental decorators, `private` as a security boundary. Breaks `erasableSyntaxOnly`/type stripping. | Medium |
| ET #75 Understand the DOM Hierarchy | `Element` vs `HTMLElement`, `Event` vs `MouseEvent`, `EventTarget` cast to an element. | Medium |
| ET #76 Create an Accurate Model of Your Environment | `lib`/`target`/global declarations that don't match the runtime (Node vs browser globals, missing `DOM` lib). | Medium |
| ET #77 Understand the Relationship Between Type Checking and Unit Testing | Behaviour that types can't guarantee left untested; tests that merely re-check what types already ensure. | Medium |

## 5. Generics and type-level code

| Item | Look for | Default |
|---|---|---|
| ET #51 Avoid Unnecessary Type Parameters | A type parameter that appears once (`<T>(x: T): void`, `<T>(): T` — the latter is a disguised cast). | Medium; High for `<T>(): T`-style return-only generics on external data |
| ET #50 Think of Generics as Functions Between Types | Missing or wrong `extends` constraints; unclear parameter names in complex generics. | Low–Medium |
| ET #52 Prefer Conditional Types to Overload Signatures | Overload sets that don't accept a union argument, or that a single signature could replace. | Medium |
| ET #53 Know How to Control the Distribution of Unions over Conditional Types | Conditional types that distribute (or don't) by accident; `never`/`boolean` edge cases. | Medium |
| ET #54 Use Template Literal Types to Model DSLs and Relationships Between Strings | Structured strings (routes, event names, CSS units) typed as `string`. | Low |
| ET #55 Write Tests for Your Types | Non-trivial generic/library types with no type tests. | Medium |
| ET #56 Pay Attention to How Types Display | Public types that render as unreadable tooltips. | Low |
| ET #57 Prefer Tail-Recursive Generic Types | Recursive types likely to hit depth limits. | Low |
| ET #58 Consider Codegen as an Alternative to Complex Types | Type gymnastics that generation would replace. | Low |
| ET #15 Use Type Operations and Generic Types to Avoid Repeating Yourself | Copy-pasted types that should derive (`Pick`, `Omit`, mapped types, `typeof`, `ReturnType`). | Medium |
| ET #28 Use Classes and Currying to Create New Inference Sites | Callers forced to pass every type argument explicitly. | Low |

## 6. Recipes worth asking for

| Item | Look for | Default |
|---|---|---|
| ET #59 Use `never` Types to Perform Exhaustiveness Checking | `switch`/if-chains over a union with a silent `default` or fall-through; adding a member compiles and is silently ignored. | High; Critical if the union just grew in this change and a case is now dropped |
| ET #61 Use `Record` Types to Keep Values in Sync | Lookup tables keyed by a union that aren't `Record<Union, …>` (or `satisfies` it), so a new member goes unhandled. | Medium; High if a member is already missing |
| ET #60 Know How to Iterate Over Objects | `Object.keys(obj) as (keyof T)[]` or `for…in` that assumes the keys; extra keys exist at runtime (structural typing). | Medium |
| ET #63 Use Optional `never` Properties to Model Exclusive Or | "Exactly one of A or B" modelled as two optional fields. | Medium |
| ET #62 Use Rest Parameters and Tuple Types to Model Variadic Functions | Overloads that only differ by arity. | Low |

## 7. API surface and declarations

| Item | Look for | Default |
|---|---|---|
| ET #67 Export All Types That Appear in Public APIs | Exported functions whose parameter/return types aren't exported. | Medium |
| ET #65 Put TypeScript and `@types` in `devDependencies` | `typescript`/`@types/*` in `dependencies` of an app or library. | Low (Medium for published libraries) |
| ET #66 Understand the Three Versions Involved in Type Declarations | Library and `@types` versions out of step. | Low–Medium |
| ET #68 Use TSDoc for API Comments | Exported APIs without doc comments where behaviour isn't obvious. | Low |
| ET #31 Don't Repeat Type Information in Documentation | JSDoc/comment restating types (`@param {string}`), which drifts. | Low |
| ET #69 Provide a Type for `this` in Callbacks if It's Part of Their API | Callbacks relying on `this` without a `this:` parameter. | Low |
| ET #71 Use Module Augmentation to Improve Types | Casts working around wrong third-party types instead of augmenting them. | Medium |
| ET #47 Prefer Type-Safe Approaches to Monkey Patching | Ad hoc properties on `window`/globals/DOM nodes via `(window as any).x`. | Medium |
| ET #70 Mirror Types to Sever Dependencies | Published libraries pulling in heavy type deps for one type. | Low |

## 8. Hygiene and style

| Item | Look for | Default |
|---|---|---|
| ET #2 Know Which TypeScript Options You're Using | The change loosens `strict`/`noImplicitAny`/`strictNullChecks` or adds a per-file escape. | High if loosened in this change |
| ET #10 Avoid Object Wrapper Types | `String`, `Number`, `Boolean`, `Object` in type positions. | Low (High for `Object`/`{}` standing in for "any object" if it admits primitives where that matters) |
| ET #13 Know the Differences Between `type` and `interface` | Inconsistent use; the 2nd edition leans to `interface` for object shapes. Follow the repo's convention. | Low |
| ET #12 Apply Types to Entire Function Expressions When Possible | Many same-shaped functions each annotated piecemeal. | Low |
| ET #79 Write Modern JavaScript | `var`, CommonJS `require` in TS modules, prototype manipulation. | Low |
| ET #7 Think of Types as Sets of Values | A reasoning tool: use it to explain why a type is too wide/narrow. | — |
| ET #78 Pay Attention to Compiler Performance | Huge unions, deep instantiation, or config changes likely to slow `tsc`. | Low |

## 9. Rarely review-relevant

Workflow, tooling and migration items: ET #1, #6, #73, #80, #81, #82, #83.
Cite #82/#83 only on migration PRs (convert leaves first; don't call a
migration done with `noImplicitAny` off).
