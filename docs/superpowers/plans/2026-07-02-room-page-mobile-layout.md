# Room Page Mobile Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `room-page.ts`'s mobile layout so stage overflow scrolls instead of silently clipping, and so height caps are computed against the room's actual available height instead of the raw device viewport.

**Architecture:** All changes are CSS-only, entirely within `room-page.ts`'s own `styles` array — no other file is modified, no TypeScript logic changes, no new components. `:host` upgrades from an inline-size container to a size container (unlocking `cqh` units while keeping every existing width-based `@container` query working unchanged), `.stage-section` becomes a real flex container so its already-scrollable child can receive a bounded height, and `.audience-section` gets a height floor it currently lacks.

**Tech Stack:** Angular 21 component styles (plain CSS, container queries, container query units `cqh`).

## Global Constraints

- CSS-only change — no TypeScript, no template structure changes, no new inputs/outputs.
- Every existing `@container room-page (...)` query must keep working unchanged (verified by the `container-type: size` upgrade being a strict superset of `inline-size`).
- Desktop (≥1024px) behavior must be unaffected — the existing `@container room-page (min-width: 1024px)` block already sets `max-height: none` on `.stage-section`, overriding all the mobile-only sizing this plan touches.
- `.comments-section`'s sizing (`max-height: 50%`) is not part of this fix and must not change — it's already relative to its actual parent, not the viewport.

---

### Task 1: Container-relative sizing and stage scroll fix

**Files:**
- Modify: `src/app/features/room/pages/room-page.ts`

**Interfaces:** None — pure CSS, no TypeScript surface change.

- [ ] **Step 1: Upgrade `:host` from an inline-size container to a size container**

Find:

```ts
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
      container-type: inline-size;
      container-name: room-page;
    }
```

Replace with:

```ts
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
      container-type: size;
      container-name: room-page;
    }
```

`:host` already has a definite height (`height: 100%`, resolved from its ancestor chain — not from its own content), so this is safe: no circular sizing risk. `size` containment is a strict superset of `inline-size` — every existing `@container room-page (min-width: ...)` rule keeps matching exactly as before, and this additionally unlocks `cqh` (container-query height units), which resolve against this element's own resolved height instead of the viewport.

- [ ] **Step 2: Make `.stage-section` a real flex container, switch its height cap from `vh` to `cqh`, and stretch `app-stage-grid` to fill it**

Find:

```ts
    .stage-section { flex-shrink: 1; min-height: 0; min-width: 0; max-height: 32vh; overflow: hidden; }
    .audience-section { flex: 1 1 0; min-height: 0; min-width: 0; overflow: hidden; }
    .comments-section {
```

Replace with:

```ts
    .stage-section {
      display: flex;
      flex-direction: column;
      flex-shrink: 1;
      min-height: 0;
      min-width: 0;
      max-height: 30cqh;
      overflow: hidden;
    }
    .stage-section app-stage-grid {
      flex: 1 1 auto;
      min-height: 0;
    }
    .audience-section { flex: 1 1 0; min-height: 22cqh; min-width: 0; overflow: hidden; }
    .comments-section {
```

Two things happening here:
- `.stage-section` was a plain flex *item* (not itself a flex *container*), so its child `<app-stage-grid>` — which already declares `overflow-y: auto` on its own `:host` but no explicit height — was never stretched to fill it and never received a bounded box to scroll within. It just grew to its natural content height and got hard-clipped by `overflow: hidden`. Making `.stage-section` `display: flex; flex-direction: column` and adding the `.stage-section app-stage-grid { flex: 1 1 auto; min-height: 0; }` child-element rule (targeting the child from the parent's own encapsulated stylesheet — the same pattern already used elsewhere in this codebase, e.g. `app-mic-button.tip { display: inline-flex; }` in `room-header.ts`) gives it that bounded box, so overflow now scrolls instead of vanishing.
- `32vh` → `30cqh`: same rough proportion, now measured against the room page's own resolved height instead of the raw device viewport (which is larger than what's actually available once the app shell's bottom-nav padding and safe-area are subtracted).
- `.audience-section` gains `min-height: 22cqh` (previously had no floor at all — only `flex: 1 1 0`), so it can never be squeezed to near-nothing on a short screen even if `.stage-section` and `.comments-section` both claim their maximum.

- [ ] **Step 3: Switch the tablet-width breakpoint's stage cap from `vh` to `cqh`**

Find:

```ts
    /* Tablet-sized mobile: a touch more stage room. */
    @container room-page (min-width: 480px) {
      .stage-section { max-height: 38vh; }
    }
```

Replace with:

```ts
    /* Tablet-sized mobile: a touch more stage room. */
    @container room-page (min-width: 480px) {
      .stage-section { max-height: 34cqh; }
    }
```

- [ ] **Step 4: Verify — stylelint and TypeScript compile**

```bash
npm run lint:styles
npx tsc --noEmit -p tsconfig.json
```

Expected: `lint:styles` shows only the pre-existing, unrelated `tokens.scss` errors (`@custom-variant` unknown at-rule, duplicate `:root` selector — not touched by this change); `tsc` passes clean. Neither command has a way to catch container-query-unit issues (no browser involved), which is why Task 2 (manual verification) exists.

- [ ] **Step 5: Verify the desktop breakpoint still overrides everything correctly**

```bash
grep -n -A6 "min-width: 1024px" src/app/features/room/pages/room-page.ts
```

Expected: the block still reads

```ts
    @container room-page (min-width: 1024px) {
      .room-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) var(--comments-panel-width);
        overflow: hidden;
      }
      .left-column { height: 100%; flex: none; }
      .stage-section { max-height: none; height: auto; flex: none; }
      .comments-section { display: flex; height: 100%; max-height: none; flex: none; }
    }
```

unchanged by Steps 1-3 — confirming `max-height: none; flex: none` on `.stage-section` at desktop widths overrides the `30cqh`/`34cqh` caps entirely, and `.audience-section`'s new `min-height: 22cqh` floor is harmless at desktop since nothing there is fighting it for space in the same cramped way mobile is.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/room/pages/room-page.ts
git commit -m "fix(room-page): use container-relative sizing for stage cap, fix stage scroll clipping"
```

---

### Task 2: Manual browser verification

**Files:** None modified — verification only, per this codebase's convention that CSS/layout changes need to be seen in a real browser, not just type-checked. Container query units (`cqh`) in particular have no automated test coverage possible here — jsdom does not implement container query evaluation at all.

- [ ] **Step 1: Start the dev server**

```bash
npm start
```

Navigate to a voice-room route.

- [ ] **Step 2: Verify stage scroll behavior**

Using devtools device toolbar, set width to 360-390px (mobile). If the room has enough speakers on stage to exceed the capped height, confirm the stage area now shows a scrollbar and lets you scroll to see all speakers, instead of silently cutting them off. If the current room doesn't have enough speakers to test this directly, verify via devtools element inspector that `.stage-section` computes as `display: flex` and its child `app-stage-grid` computes a bounded height less than its scrollHeight when many avatars are present (or temporarily reduce the container width/height to force overflow and confirm a scrollbar appears).

- [ ] **Step 3: Verify height proportions look reasonable at mobile widths**

At 360px, 390px, and 480px+ widths, confirm: the stage area doesn't dominate the screen or feel oversized, the audience list always shows a reasonable number of rows (not squeezed to 1-2 items), and comments remains reachable without the whole layout feeling cramped. Compare against the pre-fix behavior if possible (the proportions should feel similar to before — `30cqh`/`34cqh` were chosen to roughly match the prior `32vh`/`38vh` intent, just correctly scoped) — flag if `cqh`'s smaller effective base (since it excludes the bottom-nav/safe-area padding that raw `vh` incorrectly included) makes the stage area feel too small or too large in practice, since the exact values were chosen without the ability to render and check.

- [ ] **Step 4: Verify desktop (≥1024px) is unchanged**

Widen the browser to ≥1024px. Confirm the layout switches to the two-column grid exactly as before (comments as a right sidebar, stage/audience sharing the left column's full height with no caps) — this task's changes shouldn't alter anything here per Task 1 Step 5's verification, but a rendered check confirms it.

- [ ] **Step 5: Verify dark mode**

Toggle dark mode at a mobile width and confirm nothing about the stage/audience/comments sizing looks different (this is a pure layout change with no color/token changes, so dark mode should be unaffected — this step is a sanity check, not an expected source of bugs).

No commit for this task — it's verification only. If Step 3 reveals the `cqh` values need tuning, treat that as a small follow-up edit to Task 1's Step 2/3 values (not a new task) — adjust the `30cqh`/`34cqh`/`22cqh` numbers directly and re-verify.

## Self-Review Notes

**Spec coverage:** §2.1 (`container-type: size`) → Task 1 Step 1. §2.2 (`vh` → `cqh` caps) → Task 1 Steps 2-3. §2.3 (stage flex/scroll fix) → Task 1 Step 2. §2.4 (`.audience-section` min-height) → Task 1 Step 2. §3 (comments-section untouched, desktop unaffected) → verified explicitly in Task 1 Step 5 and Task 2 Step 4. §4 (out-of-scope items) → not implemented, correctly excluded from both tasks.

**Placeholder scan:** none found — every step shows exact before/after CSS or an exact command with expected output.

**Type consistency:** N/A — no TypeScript symbols introduced by this plan.
