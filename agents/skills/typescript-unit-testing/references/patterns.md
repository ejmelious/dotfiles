# Patterns for writing TypeScript unit tests

Examples use Vitest and assume v4+ unless noted; `vitest.md` lists what
differs by version.

## Contents

1. Choosing cases
2. Typed fixtures without casts
3. Doubles: fakes, stubs, mocks — typed
4. Time, randomness, environment
5. Errors and async
6. Table tests
7. Property-based tests (fast-check)
8. Type tests
9. HTTP and external services (MSW)
10. Snapshots, when they're right
11. Observables, events, streams
12. React components and hooks (unit level)

---

## 1. Choosing cases

For each behaviour, walk these and keep only cases that could catch a
distinct bug:

- **Partitions** — split the input space into classes the code treats the
  same; one representative each. For `shippingFee(weightKg, region)`:
  domestic / international × light / heavy.
- **Boundaries** — both sides of every threshold in the spec or the code:
  `>= 100` → 99.99, 100, 100.01 (or 99, 100, 101 for integers). Also: empty
  collection, one element, many; zero, negative, max safe integer; empty
  string, whitespace, unicode; first/last day of month, DST transitions,
  leap day if dates are involved.
- **Decision tables** — when several conditions combine (member? coupon?
  over threshold?), list the combinations that produce different outcomes;
  test each distinct outcome once, not all 2ⁿ rows.
- **State transitions** — from each state, each event: the legal ones
  produce the right next state; illegal ones are refused (and the state
  doesn't change).
- **Errors** — every way the caller can be told "no": thrown error types,
  `Result` error variants, rejected promises, validation messages a UI
  shows.
- **Regression** — the exact input from a bug report, titled after the
  behaviour (not the ticket number alone).
- **Partial failure after a side effect** — when code commits something
  (a write, a charge, a sent message) and then does more work (reading the
  result back, enriching it, notifying), list every dependency of that
  later work and fail each one **on its own**. Assert the outcome the
  caller should see once the side effect has happened. Usually that means
  the call still succeeds and only the extra work is degraded. A test that
  fails only one dependency proves that one guard exists, not that the
  others do. Mutation probes can't find this gap: a missing `.catch` leaves
  no line to mutate. Only enumerating the dependencies finds it.

  ```ts
  it.each([
    ["assignees", { loadAssignees: rejects }],
    ["integrations", { loadIntegrations: rejects }],
    ["availability", { loadAvailability: rejects }],
  ])("reports the saved write when loading %s afterwards fails", async (_, deps) => {
    const result = await setAssignee(input, { ...workingDeps, ...deps });
    expect(result).toEqual({ saved: true, row: null });
    expect(store.saved).toEqual([input]);
  });
  ```

## 2. Typed fixtures without casts

A factory with valid defaults and typed overrides. Defaults must be
realistic and valid, so a test only spells out what it's about:

```ts
import type { Order } from '../src/orders';

export function anOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_1',
    customerId: 'cus_1',
    status: 'pending',
    lines: [{ sku: 'SKU-1', quantity: 1, unitPriceCents: 1000 }],
    createdAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

it('refuses to ship a cancelled order', () => {
  expect(() => ship(anOrder({ status: 'cancelled' }))).toThrow(OrderNotShippable);
});
```

- For discriminated unions, write one factory per variant
  (`aPaidOrder()`, `aRefundedOrder()`) so overrides can't produce an
  impossible combination.
- Nested overrides: accept `Partial` of the nested piece explicitly rather
  than reaching for a `DeepPartial` that lets invalid shapes through.
- When a runtime schema exists (zod, valibot, arktype, io-ts), parse
  invented payloads through it — the fixture then can't drift from the
  contract, and a renamed field fails loudly in the fixture, not mysteriously
  in the assertion:
  ```ts
  const payload = webhookEventSchema.parse({ type: 'invoice.paid', data: { invoiceId: 'in_1', amountCents: 5000 } });
  ```
- Literal fixtures: `const cfg = { retries: 3, backoffMs: 100 } satisfies RetryConfig;`
  keeps the literal types and still checks the shape.
- Deterministic IDs: hard-code them, or a counter reset in `beforeEach` —
  never `randomUUID()` in fixtures that end up in assertions.
- Prefer plain factory functions to builder classes; reach for a builder
  only when fixtures have real multi-step state (`anOrder().paid().shipped()`).

## 3. Doubles — typed

**Fake (preferred for managed dependencies):** a real, small implementation.

```ts
class InMemoryOrderRepo implements OrderRepo {
  private rows = new Map<string, Order>();
  async save(o: Order) { this.rows.set(o.id, structuredClone(o)); }
  async findById(id: string) { return structuredClone(this.rows.get(id)) ?? null; }
}

it('marks the order paid', async () => {
  const repo = new InMemoryOrderRepo();
  await repo.save(anOrder({ id: 'ord_1' }));
  await markPaid({ repo }, 'ord_1');
  expect((await repo.findById('ord_1'))?.status).toBe('paid');
});
```

Clone on the way in and out, or the fake shares references with the test and
hides mutation bugs the real DB would expose.

**Stub (for queries):** return canned data; don't assert on it.

```ts
const rates: ExchangeRates = { get: async () => 1.25 };
```

**Mock (for commands to unmanaged dependencies):** assert the command.

```ts
const mailer = { send: vi.fn<Mailer['send']>().mockResolvedValue(undefined) };
await inviteUser({ mailer }, 'ada@example.com');
expect(mailer.send).toHaveBeenCalledWith(
  expect.objectContaining({ to: 'ada@example.com', template: 'invite' }),
);
expect(mailer.send).toHaveBeenCalledTimes(1); // only because a duplicate invite is a real bug
```

- Type module mocks with `vi.mocked(fn)`.
- Type a standalone mock with a function type as the generic:
  `vi.fn<(to: string) => Promise<void>>()` or `vi.fn<Mailer['send']>()`.
- If the repo already uses `vitest-mock-extended` (`mock<T>()`), keep using
  it; prefer modes where
  an unstubbed call throws instead of returning `undefined`.
- **Inject, don't module-mock.** A dependency passed as a parameter or
  constructor argument can be replaced with a plain object; a dependency
  imported at module scope needs `vi.mock`, which is hoisted, global to the
  file, and easy to get subtly wrong under ESM. Module mocks are fine for
  true external packages when injection isn't available.

## 4. Time, randomness, environment

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-31T23:59:30Z'));
});
afterEach(() => { vi.useRealTimers(); });

it('retries after the backoff, then succeeds', async () => {
  const call = vi.fn<() => Promise<string>>()
    .mockRejectedValueOnce(new Error('503'))
    .mockResolvedValueOnce('ok');
  const p = withRetry(call, { attempts: 3, backoffMs: 1000 });
  await vi.advanceTimersByTimeAsync(1000); // the Async variant lets awaited promises settle between timers
  await expect(p).resolves.toBe('ok');
  expect(call).toHaveBeenCalledTimes(2);
});
```

- Use the `*Async` timer functions (`advanceTimersByTimeAsync`,
  `runAllTimersAsync`, `runOnlyPendingTimersAsync`) whenever promises and
  timers interleave; the sync versions advance the clock without letting
  `await`ed continuations run, which produces hangs and false passes.
- If a test expects a rejection while timers advance, attach the handler
  before advancing to avoid an unhandled-rejection warning:
  `const assertion = expect(p).rejects.toThrow(TimeoutError); await vi.advanceTimersByTimeAsync(5000); await assertion;`
- Better than fake timers when you own the code: inject `now: () => Date`
  or a `Clock`, and a `sleep` the test can replace.
- Randomness: inject `random: () => number` or an ID generator; for fast-check
  the seed is handled for you.
- Env: `vi.stubEnv('FEATURE_X', 'on')` with `unstubEnvs: true` in config (or
  `vi.unstubAllEnvs()` in `afterEach`). Read env once at the edge and pass
  values in, and most tests don't need this.
- Timezones/locales: set `TZ=UTC` for the test process (script or
  `globalSetup`) and pass explicit locales to `Intl` APIs.

## 5. Errors and async

```ts
expect(() => parseAmount('12,50')).toThrow(InvalidAmount);          // sync: pass a function
await expect(loadInvoice('missing')).rejects.toThrow(NotFound);      // async: await the expect
await expect(loadInvoice('missing')).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });
```

- `toThrow(ErrorClass)` checks `instanceof`; `toThrow('text')` checks the
  message *contains* the text (so `toThrow('')` matches anything); `toThrow(/regex/)` matches the message. Check
  the property callers branch on (class, `code`), not prose.
- `Result`-style APIs: assert the discriminant and the payload —
  `expect(r).toEqual({ ok: false, error: { kind: 'insufficient_funds', shortByCents: 200 } })`.
- Guard tests whose assertions run in callbacks with `expect.assertions(n)`
  or `expect.hasAssertions()`, or restructure so they don't need it.
- Unhandled rejections: Vitest fails the run on them by default — don't
  silence that; it usually means a missing `await`.

## 6. Table tests

```ts
it.each([
  { subtotal: 99_99, expected: 0 },
  { subtotal: 100_00, expected: 10_00 },
  { subtotal: 250_00, expected: 25_00 },
] satisfies Array<{ subtotal: number; expected: number }>)(
  'discount on $subtotal cents is $expected cents',
  ({ subtotal, expected }) => {
    expect(discountCents(subtotal)).toBe(expected);
  },
);
```

Object rows keep types and readable titles (`$field` interpolation). Use a
table when only data varies; split into separate tests when the setup or
the reason differs. Don't put branching on the row inside the body — that's
two tests.

## 7. Property-based tests (fast-check)

Use when a rule holds for all inputs. Common shapes:

| Property | Example |
|---|---|
| Round-trip | `decode(encode(x))` equals `x` |
| Invariant | sorting keeps length and elements; totals conserved by a split |
| Idempotence | `normalize(normalize(s)) === normalize(s)` |
| Oracle | optimized version equals a simple reference implementation |
| Metamorphic | adding an item never lowers the total; filtering twice equals filtering once |
| Never crashes / always valid | for any input, the parser returns `ok` or a typed error and never throws; output always passes the schema |

```ts
import fc from 'fast-check';

it('splitting a bill conserves the total', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 10_000_000 }), fc.integer({ min: 1, max: 50 }), (cents, people) => {
      const shares = splitBill(cents, people);
      expect(shares).toHaveLength(people);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(cents);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    }),
  );
});
```

- Constrain generators to the valid domain (or test the rejection of the
  invalid domain separately); build domain arbitraries once
  (`const anyOrder = fc.record({...})`) and reuse them.
- On failure fast-check prints a shrunk counterexample plus `seed` and
  `path`; add the counterexample as a plain example test so it's
  permanently pinned, and keep the property.
- `@fast-check/vitest` offers `test.prop([...])(...)` if the repo uses it.
- Keep `numRuns` at the default unless the test is slow; properties belong
  in the fast suite.

## 8. Type tests

When the types are the API (generic utilities, inference, overloads):

```ts
// pick.test-d.ts
import { expectTypeOf } from 'vitest';

expectTypeOf(pick({ a: 1, b: 'x' }, ['a'])).toEqualTypeOf<{ a: number }>();
expectTypeOf<Admin>().toExtend<User>(); // toMatchTypeOf is deprecated
// @ts-expect-error — 'c' is not a key
pick({ a: 1 }, ['c']);
```

These are checked by `vitest --typecheck` (default pattern `*.test-d.ts`)
or `tsc`, not by running the test. Confirm one of those actually runs in the
repo's scripts or CI, or they test nothing.

## 9. HTTP and external services (MSW)

Mock at the network edge so your real HTTP client code runs:

```ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('maps a 404 from the billing API to InvoiceNotFound', async () => {
  server.use(http.get('https://billing.example.com/invoices/:id', () => new HttpResponse(null, { status: 404 })));
  await expect(fetchInvoice('in_1')).rejects.toThrow(InvoiceNotFound);
});
```

`onUnhandledRequest: 'error'` makes an unexpected request fail the test
instead of reaching the internet. Parse response fixtures through the
provider's schema where one exists.

## 10. Snapshots, when they're right

Right: small, stable, textual output whose exact form *is* the contract —
CLI help, generated code/SQL, an error message users see, a serializer's
output. Prefer inline so the expectation is reviewed with the test:

```ts
expect(formatAddress(addr)).toMatchInlineSnapshot(`"221B Baker St, London NW1 6XE"`);
```

Wrong: whole API responses, component trees, objects with IDs/timestamps,
anything where nobody can say which part matters. For dynamic fields, use
property matchers: `toMatchSnapshot({ id: expect.any(String), createdAt: expect.any(Date) })`.
Treat every snapshot update as a code change to review, not a chore.

## 11. Observables, events, streams

- RxJS: `await firstValueFrom(obs$)` / `lastValueFrom(obs$.pipe(toArray()))`
  (`toPromise()` is deprecated). For timing-heavy operators, use
  `TestScheduler` marble tests.
- Node events: `const [payload] = await once(emitter, 'done')` from
  `node:events`.
- Async iterables: collect with `for await` into an array (or
  `Array.fromAsync` on Node 22+) and assert the array.
- Never put `expect` inside a `subscribe` or `on(...)` callback without
  awaiting completion — failures become timeouts or vanish.

## 12. React components and hooks (unit level)

- Testing Library: query the way users find things (`getByRole`,
  `getByLabelText`, `findByText`), interact with `@testing-library/user-event`
  (`await user.click(...)`), assert what's on screen. Don't assert component
  state, props passed to children, or class names unless they're the contract.
- Hooks: `renderHook` and assert the returned values after `act`; prefer
  testing the component that uses the hook when the hook is an
  implementation detail.
- Mock network with MSW, not by mocking your API module.
- jsdom/happy-dom don't do layout, real focus management or many browser
  APIs; behaviour that depends on them belongs in a browser-mode or e2e test.
