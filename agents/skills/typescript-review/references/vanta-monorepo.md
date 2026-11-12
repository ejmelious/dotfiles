# Vanta monorepo idioms

Read this when reviewing in Vanta's monorepo, where the root `AGENTS.md` starts "Vanta Monorepo — Agent Guide". The repo's lint rules forbid several patterns that general TypeScript advice recommends. Recommend the repo's alternative, and never suggest a fix the lint will flag. Re-check each rule against its doc (`oxlint-plugin-vanta/lib/rules/**/<rule>.md`) when you rely on it: rules change.

## Deriving types (`vanta/no-derived-types`)

The rule rejects indexed access (`Foo["x"]`), type queries (`typeof value`), `ReturnType`, `Parameters`, `Awaited`, `ResultOf`, `InferSchemaType` and similar. It allows `Pick`, `Omit`, `Partial`, `Readonly`, `NonNullable`, `Record`, `keyof` and explicit declarations.

So ET #15 ("derive instead of repeating") applies only through those allowed tools:

| Want | Recommend |
|---|---|
| Some fields of a generated or shared type, same names | `Readonly<Pick<Generated, "a" \| "b">>`, or `extends` it in an interface |
| One field under a different name | an explicit type, preferably a generated scalar (below); `Generated["x"]` is flagged |
| A closed set of string values plus a runtime check | a string `enum` validated with `z.enum(TheEnum)` (zod v4); see `client-ownership`'s `OwnableItemSchema` |
| The type of a zod schema | an explicit interface annotated on the schema (`const S: z.ZodType<T> = …`), not `z.infer` |

Flag as **Medium** a union paired with a `Record<Union, true>` or a hand-written guard for the same values. The enum plus `z.enum` form keeps one list and gets the check from zod. Note the trade-off: string enums are nominal, so assigning a literal like `"DRAFT_STALE"` to the enum type is a compile error (TS2322), though comparing against one still compiles. Check the PR's callers before recommending the change.

## GraphQL client types (gqlts)

- **Fragment result types** come from `#graphql/fragments/<FragmentName>.ts` (`<FragmentName>Fragment`, `<FragmentName>Data`). A hand-written interface that copies fields of a fragment the code reads is a **Medium** finding. The root `AGENTS.md` says to reuse generated contracts and keep their nullability.
- **Scalars and enums**: use `graphql.schema<"DateTime">` from the file's own generated module (`import type { graphql } from "#graphql/<same path>.ts"`). Importing `#graphql/schema/*` directly is flagged by `vanta/restricted-imports`. After adding that import, run the package's `generate-client-types` task so the per-file module exists.
- An `ID` field is a plain `string`, and gqlts exposes no `ID` alias. Explicit `string` is correct there.

## Errors

- **Apollo error parsing**: `packages/client-observability/src/errors.ts` already pulls codes from both `graphQLErrors` and `networkError.result` (`errorIsApolloWithErrorCode`). Before accepting a new extractor of `networkError.result.errors`, check there and in other `client-*` packages (`rg "networkError.result"`). Flag a copy as **Medium** duplication with the existing helper named.
- **`vanta/no-unique-id-in-error-message`** treats the first argument of any `new *Error(…)` as a message, so `new ApolloError({ … })` triggers it falsely. A one-line test helper that builds `ApolloError` keeps the warning in one place. That's legitimate when it carries a comment saying so. Don't flag it as a pointless wrapper, and don't suggest `eslint-disable`.

## Hard rules (from the root `AGENTS.md`)

No `any`, no `as` (except `as const`), no `!`, and no new `eslint-disable`. A fix that needs one of these is not acceptable here. Use `satisfies`, narrowing, or zod.
