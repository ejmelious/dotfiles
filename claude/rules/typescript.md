---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
  - "**/*.cts"
---

# TypeScript and ESLint

Loaded by Claude Code only when working with TypeScript files.

## ESLint

- Fix the underlying issue rather than disabling a rule.
- Use `eslint-disable` only as a last resort, for one line, with a comment explaining why.

## Types

- Don't use `any`. Use a proper interface, or `unknown` narrowed with a type guard.
- Use `Record<string, never>` for an empty object type, not `{}`.
- Remove unused variables, or prefix them with `_` when they must stay (e.g. a positional parameter).
- Type function parameters and return values explicitly.

```typescript
// Bad
const data: any = response.data;
function processData(input: any): any { ... }

// Good
interface ResponseData { id: string; name: string; }
const data: ResponseData = response.data;
function processData(input: ResponseData): ProcessedResult { ... }
```
