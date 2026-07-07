# Coding Guide

A complete, self-contained explanation of every convention this codebase follows, why it
exists, and how to stay inside it. Read this before adding a feature, a service, or a
component. Examples are drawn from the actual code.

Verified against Angular 22.0 / TypeScript 6.0.3. The CI-enforced conventions run via
`npm run verify`.

---

## 1. The shape of the app

```
src/app/
├── core/        infrastructure loaded once: auth, http, error, config, guards, tokens
├── shared/      reusable & stateless: ui/, directives/, pipes/, utils/, testing/
├── store/       global, long-lived state only (auth lives in core/auth)
├── styles/      design tokens + theme (light/dark)
├── layout/      app shell: header, sidebar, footer
└── features/    isolated capabilities, each a self-contained vertical slice
```

Everything has exactly one correct home. When you are unsure where something goes, the
deciding question is almost always *"what is its lifecycle and who depends on it?"* — not
*"what kind of thing is it?"*.

---

## 2. Dependencies only ever point downward

This is the rule the entire structure exists to protect:

```
features  →  store  →  core  →  shared
```

- `shared/` is the floor. It imports nothing else in the app.
- `core/` may import `shared/` only.
- `store/` may import `core/` and `shared/`.
- `layout/` may import `store/`, `core/`, `shared/`.
- `features/` may import `store/`, `core/`, `shared/`.
- Nothing imports a feature except the router.

**Why it matters.** An import that points upward (e.g. `core/` reaching into `store/`)
or sideways (one feature reaching into another) is exactly how a codebase that looks
modular on disk turns into a tangle where nothing can be changed in isolation. Direction
is the discipline; every other rule below is a consequence of it.

**A real example from this codebase.** The global error handler in `core/` originally
imported `NotificationStore` from `store/`. That is an illegal upward edge. The fix was
not to allow the import — it was to invert the dependency: `core/error/` defines an
`ERROR_REPORTER` abstraction (an `InjectionToken`), the handler depends on that, and
`app.config.ts` binds the token to the store. The composition layer (`app.config.ts`) is
the one place allowed to wire `core` and `store` together. If you ever find yourself
wanting an upward import, that is the signal to introduce an abstraction the lower layer
owns — not to bend the direction.

**Enforced by** `eslint-plugin-boundaries`. A violating import fails the build.

---

## 3. A feature never imports another feature

`features/reports/` may import its own files. It may not import anything under
`features/dashboard/`, and vice-versa.

**Why.** Cross-feature imports are the single most common cause of decay. The moment one
feature reaches into another, you can no longer extract it, lazy-load it cleanly, or hand
it to a different team. Two features that genuinely need to share code are telling you
that shared code belongs *down* in `shared/` or `core/`, not *across*.

**Enforced by** ESLint boundaries (it captures the feature name, allows a feature to
import itself, denies siblings) and independently by dependency-cruiser. Two gates,
because this rule is worth catching twice.

---

## 4. A feature is a black box with one public door

Every feature exposes a single `index.ts`. Outside code — the router, anything — imports
**only** from that file. Reaching into `features/reports/data-access/...` from outside is
forbidden.

```ts
// features/reports/index.ts — the only export surface
export { REPORTS_ROUTES } from './reports.routes';
export type { Report } from './models/report.model';
```

**Why.** Without a single export surface, every internal file becomes everyone's public
API. A rename three folders deep breaks distant code. The `index.ts` is a contract: inside
is yours to refactor freely; outside sees only what you chose to expose.

**Enforced by** dependency-cruiser. The router lazy-loads via `import('./features/reports')`,
which resolves to `index.ts` — so the public door is also the loading boundary.

---

## 5. A feature's internal layout

```
features/reports/
├── pages/           routed SMART components (one per route)
├── ui/              dumb / presentational components (feature-local)
├── data-access/     services + the reactive data sources
├── models/          feature-local domain models
├── store/           ephemeral, component-provided state
├── utils/           pure functions — formatting, derivations, no DI, no `this`
├── reports.routes.ts
└── index.ts
```

Not every feature needs every folder — `dashboard/` has only `pages/` because it has no
local state or dumb components yet. Add folders when you have something to put in them, not
preemptively.

**Pure logic belongs in `utils/*.util.ts`, not inline in the component.** If a method has no
`this` dependency — date/label formatting, grouping, deriving one value from another — it's a
plain exported function, not a component method that happens not to use `this`. This keeps
the component thin (orchestration + template glue only) and makes the logic trivially
unit-testable without a `TestBed`. `features/room/data/*.util.ts` (`ghost-audience.util.ts`,
`kicked-from-room.util.ts`) and `features/messages/utils/dm-formatting.util.ts` are the
pattern to follow.

**Genuine business rules — authorization, permission checks, invariants that show up in more
than one place — get their own file** (e.g. a `rules/` folder with `PermissionRules.canKick()`
-style pure functions), once a feature actually has enough of them to be worth centralizing.
Don't create `rules/` preemptively: a feature with one or two inline permission checks doesn't
need it yet — see `features/room/pages/room-page-base.ts`'s `openUserActions()` for a current
example of an inline check that would be a first candidate if/when Room's permission logic
grows past a couple of call sites.

---

## 6. Smart vs. dumb components, and when something graduates to `shared/`

- **Pages (smart).** Live in `features/x/pages/`. They inject the store, orchestrate,
  handle navigation, and pass plain data down. They own *behaviour*. They are what the
  route loads. They never move out of the feature — they are tied to routes.
- **UI (dumb).** Inputs in, outputs out. No service injection, no store access,
  `ChangeDetectionStrategy.OnPush`. Pure presentation.

The rule that keeps `ui/` honest: **a dumb component that depends on nothing
feature-specific belongs in `shared/ui/`, not in the feature.** Feature `ui/` is only for
presentational components that happen to use a feature-local model. If it just renders
what it is handed, it is reusable, and reusable presentational code lives in `shared/`.

```ts
// shared/ui/error-message.ts — depends on nothing feature-specific, so it is shared.
@Component({
  selector: 'app-error-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error-message" role="alert">
      <p>{{ message() ?? 'Something went wrong.' }}</p>
      @if (showRetry()) {
        <button type="button" (click)="retry.emit()">{{ retryLabel() }}</button>
      }
    </div>
  `,
})
export class ErrorMessage {
  readonly message = input<string | null>(null);
  readonly showRetry = input(true);
  readonly retryLabel = input('Retry');
  readonly retry = output<void>();
}
```

Directives go in `shared/directives/`, pipes in `shared/pipes/`. Never mix component
types inside one `ui/` folder.

---

## 7. State lives where its lifecycle lives

Placement is decided by lifecycle, never by "it is state, so it goes in the store folder".

- **App-wide, persists across routes** → root `store/`, `providedIn: 'root'`. One store per
  concern — `auth`-adjacent UI, `theme.store.ts`, `notification.store.ts` — never one
  catch-all store.
- **Session / identity** → `core/auth/`. It is infrastructure that guards and interceptors
  depend on; putting it in `store/` would force an illegal `core → store` edge (see §2).
- **Ephemeral, feature-scoped** → `features/x/store/`, component-provided.

**Feature stores are NEVER `providedIn: 'root'`.** They use a bare `@Injectable()` and are
listed in the page component's `providers: []`:

```ts
@Component({
  // ...
  providers: [ReportsStore, ReportsService], // scoped to this page's lifecycle
})
export class ReportsList { /* ... */ }
```

**Why.** A root-provided store for a short-lived view never goes away — it leaks memory and
its state outlives the screen that used it. A component-provided store is destroyed when
the page is, which is what you want for view-scoped state.

**Enforced by** a custom ESLint rule scoped to `features/*/store/` that errors on
`providedIn: 'root'`. The global stores in `store/` and `core/auth/` correctly *are*
root-provided, because their lifecycle is the whole app.

**`@Service()` vs `@Injectable()`.** Angular 22 introduced `@Service()` as the DI decorator
going forward — `@Service()` (no args) is root-auto-provided, equivalent to
`@Injectable({ providedIn: 'root' })`; `@Service({ autoProvided: false })` is equivalent to a
bare `@Injectable()` with no `providedIn`, for page-scoped stores. The codebase is
**mid-migration**: some root stores (`theme.service.ts`, `notification.store.ts`,
`active-call.store.ts`, `rooms-preferences.store.ts`) already use `@Service()`; the
`features/room` feature (the largest, most recently refactored) still uses `@Injectable()`
throughout. Both are valid today — don't do a drive-by rename when touching unrelated code —
but **new** root-scoped services/stores should use `@Service()`, and new page-scoped ones
should use `@Service({ autoProvided: false })`, matching the rule above exactly (a
page-scoped store must never resolve at root, whichever decorator spells that).

---

## 8. Reactive data with `rxResource` / `httpResource`

Async data is handled with the resource APIs, not manual `subscribe()` + loading/error
signals. This codebase has **zero** manual `.subscribe()` calls.

```ts
// features/reports/store/reports.store.ts
@Injectable()
export class ReportsStore {
  private readonly service = inject(ReportsService);

  // Typed <Result, Params> with a defaultValue, so value() is never undefined.
  private readonly reportsRef = rxResource<Report[], void>({
    stream: () => this.service.getReports(),
    defaultValue: [],
  });

  readonly reports = this.reportsRef.value;       // Signal<Report[]>
  readonly loading = this.reportsRef.isLoading;
  readonly error = computed(() => (this.reportsRef.error() ? 'Failed to load reports' : null));

  reload(): void { this.reportsRef.reload(); }
}
```

**Why this over manual subscriptions.** `rxResource` cancels the in-flight request when
you `reload()`, so the request-race and re-entrancy bugs you would otherwise hand-guard
against simply cannot happen. It also removes the `takeUntilDestroyed` plumbing that manual
subscriptions need.

Conventions when you do use it:
- **Always type it** — `rxResource<Result, Params>` / `httpResource<Dto[]>`. Untyped
  resources produce `{}`-typed values in templates.
- **Always give a `defaultValue`** — it removes the `value() ?? []` guards everywhere
  downstream.
- **Keep `stream` pure** — it is a factory for the Observable, not a place for side effects.

Expose only read-only signals from a store. Components never touch the resource ref
directly.

---

## 9. Subscription hygiene (the rule no tool can check)

If you ever do write a manual `subscribe()` inside a component-provided service, it **must**
use `takeUntilDestroyed`. Capture `DestroyRef` in the constructor (the injection context)
and pass it explicitly if you subscribe outside the constructor:

```ts
private readonly destroyRef = inject(DestroyRef);
// ...later, inside a method:
this.service.getThing()
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(/* ... */);
```

**Why this is called out separately.** Destroying a service's DI instance does **not**
automatically tear down a subscription it started. Effects created in the injection context
are cleaned up; raw subscriptions are not. No linter checks this. Green CI does not mean
leak-free — this is the rule most likely to be violated silently, which is exactly why the
codebase prefers `rxResource` and avoids manual subscriptions in the first place.

---

## 10. Change detection and component declaration

- Every component declares `ChangeDetectionStrategy.OnPush`.
- The app bootstraps with `provideZonelessChangeDetection()`.
- Do **not** write `standalone: true` — it has been the default since Angular 19, so it is
  redundant noise. (Standalone is implicit; NgModule-based code would need an explicit
  `standalone: false`, which this codebase has none of.)

**Why.** OnPush + signals is the performance baseline; with zoneless change detection,
the UI updates from signal reads, not from zone-triggered global checks. A component that
forgets OnPush quietly opts out of that model.

---

## 11. Routing

- **Lazy by default.** Every feature route uses `loadChildren` pointing at the feature's
  `index.ts`. Features are code-split into their own chunks.
- **Every route has a `title`.** It sets the document title and is an accessibility win.
- **Guards are functional** and live in `core/guards/`. They are applied with
  `canActivate: [authGuard]`.
- **Error routes are explicit plus a wildcard.** `/error/500`, `/error/403`, and a trailing
  `**` route all render the same `ErrorPage`; the status code is passed via route `data`
  and bound to a component input (`withComponentInputBinding`). The `**` route is always
  last.
- **A routed input must tolerate `undefined`.** The router sets a bound input to `undefined`
  when no matching route data exists, so transforms accept `string | number | undefined`
  and default sensibly:

```ts
readonly code = input(404, { transform: (v: string | number | undefined) => Number(v) || 404 });
```

```ts
// app.routes.ts
{
  path: 'reports',
  title: 'Reports',
  canActivate: [authGuard],
  loadChildren: () => import('./features/reports').then((m) => m.REPORTS_ROUTES),
},
{ path: '**', title: 'Not found', component: ErrorPage, data: { code: 404 } },
```

Secure-by-default: with no session, a guarded route redirects rather than rendering.

---

## 12. Error handling has distinct, cooperating layers

There is no React-style component error boundary in Angular. Errors are handled at the
layer that can actually see them, and the layers cooperate rather than replace each other:

- **HTTP interceptor** (`core/http/interceptors/error.interceptor.ts`) — the first place an
  HTTP error is seen, and the only place that can act on a status code. It owns
  HTTP-universal policy: exponential-backoff retry of transient statuses (408/429/5xx) on
  idempotent methods only — retries run *before* the failure is surfaced anywhere — and
  centralized navigation for session-level failures only (401 → `/error/401`, 403 →
  `/error/403`). All other failures (404, 5xx, network) are re-thrown for the feature
  layer to surface in place: a failing background call (heartbeat, roster refresh) must
  never eject the user to a full-page error while the app is otherwise working.
- **Feature store** — owns domain meaning. What "failed to load reports" means to *this*
  view, surfaced through the store's `error()` signal.
- **Inline `ErrorMessage`** (`shared/ui/`) — pure presentation of an error state, with an
  optional retry output.
- **Full-page `ErrorPage`** (`core/error/`) — the routed 404/500/403 component.
- **Global `ErrorHandler`** (`core/error/`) — the app-wide safety net for *uncaught* errors,
  surfacing them via the `ERROR_REPORTER` abstraction (see §2).
- **`@error` block** — fires only when a `@defer` chunk fails to load. It is not a general
  render-error catch.

**The division to remember.** The interceptor handles what is true for *every* request
(retry, auth redirect, status mapping). The feature store handles what a failure *means* to
one screen. Putting feature-specific messages in the interceptor couples it to every
feature; duplicating retry/auth logic in each store copies the same code everywhere. Keep
universal policy in the interceptor, domain meaning in the store.

---

## 13. Cross-boundary imports use path aliases

Within a feature, relative imports (`./`, `../`) are fine. Crossing a layer boundary uses
an alias, never a chain of `../../../`:

```ts
import { API_BASE_URL } from '@core/tokens/api-base-url.token'; // not ../../../core/...
```

Aliases (`@core/*`, `@shared/*`, `@store/*`, `@features/*`) are defined in `tsconfig.json`.
A `../`-chain that climbs out of a feature is both unreadable and a sign you are crossing a
boundary you should be crossing through the alias (and through the feature's public API).

---

## 14. Environments

Three typed environments, swapped at build time by `angular.json` fileReplacements:

| Build | apiBaseUrl |
|---|---|
| development (`npm start`) | `http://localhost:3000/api` |
| staging (`npm run build:staging`) | `https://staging-api.example.com` |
| production (`npm run build:prod`) | `/api` |

- `environment.ts` is the **base / production** file (Angular convention); the dev and
  staging configurations replace it. All three are typed as `AppConfig`, so a missing or
  renamed field is a compile error, not a runtime surprise.
- The environment object flows into DI in `app.config.ts`: provided as `APP_CONFIG`, with
  `API_BASE_URL` derived from it. Services inject the token, not the environment file
  directly — so swapping the environment swaps the value everywhere through one binding.

Never read an environment file from inside a feature. Go through the injected token.

---

## 15. TypeScript strictness

On top of Angular's `strict` defaults, two high-value flags are on:

- **`noUncheckedIndexedAccess`** — indexing an array or record yields `T | undefined`,
  forcing you to handle the missing case (`arr.at(-1) ?? fallback`). Catches a whole class
  of "it was there in dev" bugs.
- **`exactOptionalPropertyTypes`** — `{ x?: T }` no longer silently accepts an explicit
  `undefined`; absent and present-but-undefined are distinct.

Practices:
- Prefer `satisfies` to `as`. Reserve `as` for genuine last-resort assertions.
- Annotate return types on exported functions so a body change cannot silently alter the
  contract. Let inference handle internals.
- Use `unknown` (then narrow), never `any`.
- Expose `readonly` signals from stores; keep the writable source private.

---

## 16. Styling uses design tokens

Colors, spacing, and radii are CSS custom properties defined once in `styles/tokens.scss`,
with light/dark values composed in `styles/theme.scss`. Components reference the tokens;
they do not hardcode values.

```scss
/* good */  border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
/* bad  */  border: 1px solid #dc2626;
```

A hardcoded color is a value that will be wrong in dark mode and impossible to retheme.
If a token you need does not exist, add it to `tokens.scss` (and its dark variant to
`theme.scss`) rather than inlining the literal.

---

## Quick checklist before opening a PR

- [ ] No import points upward or sideways across layers (`npm run lint`).
- [ ] New feature exposes only its `index.ts`; nothing imports its internals.
- [ ] No feature imports another feature.
- [ ] Feature store is `@Injectable()` and provided in the page, not root.
- [ ] No manual `.subscribe()` without `takeUntilDestroyed` (prefer `rxResource`).
- [ ] Component is `OnPush`; no redundant `standalone: true`.
- [ ] Route has a `title`; any routed input tolerates `undefined`.
- [ ] No hardcoded colors — use tokens.
- [ ] No environment file read from inside a feature — go through `API_BASE_URL`.
- [ ] `npm run verify` passes (boundaries, cycles, dependency graph).