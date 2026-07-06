# UserInfoModal Room-Presence Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "currently in <room>" banner at the top of `UserInfoModalComponent` showing the modal-target user's current room (via `/users/{id}/status`, already wired by commit `c0da2dd`), the room's host avatar + name, and two CTA buttons (Join Visible / Join as Guest) that close the modal and navigate to the room.

**Architecture:** Two new files (a shared util for the LS_/VR_→busiType rule, and a dumb presentational banner component in `shared/ui/`) + thin wiring into `UserInfoModalComponent`. A trivial migration of an existing inline check in `voice-list.ts` to use the new shared util.

**Tech Stack:** Angular 22 signals + computed, `@angular/cdk/dialog` `DialogRef.close()`, `Router.navigate()`, existing `UserInfoService.fetchUserPresence`/`fetchUserInfo` (no new backend).

## Global Constraints

- `exactOptionalPropertyTypes` is on — use `readonly field: T | null` for nullable fields, matching every existing model in `user-info.service.ts`.
- `noUncheckedIndexedAccess` is on — array indexing needs `?? fallback` or an explicit length check.
- Zero manual `.subscribe()` calls — use the existing reactive primitives in `UserInfoService`. The one-off `Router.navigate` from the banner is async/imperative (same pattern as `UserInfoModalComponent.toggleFollow`).
- Every component: `ChangeDetectionStrategy.OnPush`, no redundant `standalone: true`.
- No hardcoded colors — every style value is a `var(--...)` token. The `chip-presence` accent style already exists from `c0da2dd` — reuse it.
- The new banner component is feature-agnostic, so it lives in `shared/ui/room-presence-banner/`, per CLAUDE.md §6 (same precedent as `ProfileStatsBarComponent` flagged in the recent code review).
- No new backend changes — every endpoint this consumes already exists.
- No new spec files (per `/feedback_no-unit-tests-unless-asked.md` in memory: don't write tests unless asked). Inline tests are allowed for the tiny `cnameToBusiType` util since the existing codebase precedent (`/shared/utils/relative-time.util.spec.ts`) is to inline-test shared utils.

---

## File Structure

```
shared/utils/
└── room-busi-type.ts                    # NEW: cnameToBusiType() — single source of truth
                                            #      for the LS_→1 / VR_→2 / other→null rule

shared/ui/room-presence-banner/
├── room-presence-banner.component.ts    # NEW: dumb presentational component
└── index.ts                             # NEW: barrel re-exporting RoomPresenceBannerComponent

shared/ui/user-info-modal/
├── user-info-modal.component.ts          # MODIFIED: import banner, wire host fetch +
                                            #             joinRoom() handler
└── index.ts                             # MODIFIED: re-export the banner so the modal
                                            #              page can import it (optional)

features/rooms/pages/voice-list/
└── voice-list.ts                        # MODIFIED: replace inline busiType check with
                                            #              cnameToBusiType() (DRY)
```

Total: 3 new files (~180 lines), 3 modified files (~30 net lines added).

---

### Task 1: Extract `cnameToBusiType()` shared util

Both `room-presence-banner` (new) and `voice-list.ts` (existing) need to map a cname
prefix to a busiType. Extract it now so both call sites share one rule.

**Files:**
- Create: `src/app/shared/utils/room-busi-type.ts`
- Modify: `src/app/shared/utils/index.ts` (re-export the helper)
- Modify: `src/app/features/rooms/pages/voice-list/voice-list.ts:joinRoom` (use the helper)

**Interfaces:**
- Produces: `cnameToBusiType(cname: string): 1 | 2 | null` — returns `1` for `LS_*` (live/video),
  `2` for `VR_*` (voice), `null` for any other prefix or empty string.

**Implementation:**

```ts
// shared/utils/room-busi-type.ts
/**
 * Map a HelloTalk room cname to its business-type identifier.
 *
 *   LS_xxx  →  1  (live / video room, navigates to /room/video/...)
 *   VR_xxx  →  2  (voice room,     navigates to /room/...)
 *   else    →  null (unknown prefix — caller should refuse the navigate)
 *
 * Single source of truth for the LS_/VR_ prefix convention, previously duplicated
 * inline in voice-list.ts and now needed by the room-presence-banner too.
 */
export type RoomBusiType = 1 | 2;

export function cnameToBusiType(cname: string): RoomBusiType | null {
  if (!cname) return null;
  if (cname.startsWith('LS_')) return 1;
  if (cname.startsWith('VR_')) return 2;
  return null;
}
```

Re-export from `src/app/shared/utils/index.ts`:
```ts
export { cnameToBusiType, type RoomBusiType } from './room-busi-type';
```

In `voice-list.ts` (the existing `joinRoom` method), replace:
```ts
const path = busiType === 1 ? '/room/video' : '/room';
const queryParams = visible ? {} : { visible: 'false' };
```
with:
```ts
const path = busiType === 1 ? '/room/video' : '/room';
const queryParams = visible ? {} : { visible: 'false' };
```
(actually — `voice-list.ts` already has its own busiType derived from the channel list,
not from the cname, so the `cnameToBusiType` migration here is a **no-op** for that path.
Skip the voice-list.ts change in this task; the banner will use the helper independently.
The helper still belongs in `shared/utils` because it's the only place defining this rule
and we want the banner to share it with any future call site.)

- [ ] **Step 1: Create the util file**

Create `src/app/shared/utils/room-busi-type.ts` with the content above (note: inline doc
comment block is mandatory — documents the LS_/VR_ contract for future readers).

- [ ] **Step 2: Re-export from `shared/utils/index.ts`**

Append to `src/app/shared/utils/index.ts`:
```ts
export { cnameToBusiType, type RoomBusiType } from './room-busi-type';
```

- [ ] **Step 3: Typecheck**

Run: `cd JilaliTalk-angular-frontend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
cd JilaliTalk-angular-frontend
git add src/app/shared/utils/room-busi-type.ts src/app/shared/utils/index.ts
git commit -m "feat(shared): extract cnameToBusiType helper

LS_→1 / VR_→2 / other→null. Single source of truth for the prefix
convention that determines the room route (/room vs /room/video)
and the busiType passed alongside. Previously the voice-list page
encoded this inline; the new room-presence-banner needs the same
rule, so extract now to keep the two call sites from drifting."
```

---

### Task 2: Build the dumb `RoomPresenceBannerComponent`

A standalone presentational component. Takes the resolved `UserPresence`, an optional
host `UserInfo`, and emits `(join)` with `{ visible: boolean }`. No service injection,
no router — fully dumb, per CLAUDE.md §6.

**Files:**
- Create: `src/app/shared/ui/room-presence-banner/room-presence-banner.component.ts`
- Create: `src/app/shared/ui/room-presence-banner/index.ts`

**Interfaces:**
- Consumes:
  - `@Input() presence: UserPresence | null` — `null` means render nothing
  - `@Input() hostInfo: UserInfo | null` — used only when `presence.statusType === 2`
  - `@Output() join = new EventEmitter<{ visible: boolean }>()`
- Produces: nothing — purely presentational.

**Implementation:**

```ts
// shared/ui/room-presence-banner/room-presence-banner.component.ts
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { LucideMic, LucideUserRound } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import type { UserPresence } from '@core/services/user-info.service';
import type { UserInfo } from '@core/services/user-info.service';

@Component({
  selector: 'app-room-presence-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    ButtonComponent,
    CountryFlagComponent,
    LucideMic,
    LucideUserRound,
  ],
  template: `
    @if (presence(); as p) {
      @if (shouldShow()) {
        <section class="presence-banner" aria-label="Currently in a room">
          <header class="banner-header">
            <svg aria-hidden="true" lucideMic [size]="12" class="header-icon"></svg>
            <span class="header-label">{{ headerLabel() }}</span>
          </header>

          <div class="room-name" [title]="p.cname">{{ roomNameLabel() }}</div>

          @if (hostRowVisible()) {
            <div class="host-row">
              <app-avatar
                [src]="hostAvatarSrc()"
                [alt]="hostName() ?? 'Host'"
                [initials]="hostInitials()"
                size="xs"
              />
              <div class="host-meta">
                <span class="host-name">{{ hostName() }}</span>
                @if (hostNationality(); as code) {
                  <app-country-flag [code]="code" />
                }
              </div>
            </div>
          }

          <div class="actions">
            <app-button variant="primary" size="sm" (click)="onJoin(true)">Join Visible</app-button>
            <app-button variant="soft-neutral" size="sm" (click)="onJoin(false)">Join as Guest</app-button>
          </div>
        </section>
      }
    }
  `,
  styles: [`
    .presence-banner {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      margin: 0 var(--space-4) 0;
    }
    :host-context(.dark) .presence-banner {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }
    .banner-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .header-icon { color: var(--color-accent-500); flex-shrink: 0; }
    .header-label {
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    :host-context(.dark) .header-label { color: var(--color-neutral-400); }
    .room-name {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host-context(.dark) .room-name { color: var(--color-neutral-100); }
    .host-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) 0;
    }
    .host-meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      flex: 1;
    }
    .host-name {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host-context(.dark) .host-name { color: var(--color-neutral-300); }
    .actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-1);
    }
    .actions app-button { flex: 1; }
  `],
})
export class RoomPresenceBannerComponent {
  readonly presence = input<UserPresence | null>(null);
  readonly hostInfo = input<UserInfo | null>(null);
  readonly join = output<{ visible: boolean }>();

  readonly shouldShow = computed(() => {
    const p = this.presence();
    return !!p && !p.blackened && (p.statusType === 1 || p.statusType === 2);
  });

  readonly headerLabel = computed(() =>
    this.presence()?.statusType === 1 ? 'Hosting' : 'In room',
  );

  readonly roomNameLabel = computed(() => {
    const p = this.presence();
    if (!p) return '';
    const name = p.roomName?.trim();
    if (name) return name;
    // Fallback when the capture/response had no displayable room name.
    return p.statusType === 1 ? 'Hosting a room' : 'In a room';
  });

  readonly hostRowVisible = computed(() => this.presence()?.statusType === 2);

  readonly hostName = computed(() => this.hostInfo()?.nickname ?? null);

  readonly hostAvatarSrc = computed(() => this.hostInfo()?.details?.base?.headUrl ?? '');

  readonly hostInitials = computed(() => {
    const n = this.hostName();
    return n ? n.slice(0, 2) : 'H';
  });

  readonly hostNationality = computed(() => {
    const info = this.hostInfo();
    return info?.nationality ?? info?.details?.base?.nationality ?? null;
  });

  onJoin(visible: boolean): void {
    this.join.emit({ visible });
  }
}
```

```ts
// shared/ui/room-presence-banner/index.ts
export { RoomPresenceBannerComponent } from './room-presence-banner.component';
```

- [ ] **Step 1: Create the component file**

Write `src/app/shared/ui/room-presence-banner/room-presence-banner.component.ts` with the
content above. **Read the existing `AvatarComponent` and `ButtonComponent` signatures
before writing** — confirm that `AvatarComponent`'s `size` accepts `'xs'` (the existing
sizes per CLAUDE.md are `'sm' | 'md' | 'lg' | 'xl'`; if `'xs'` isn't there, use `'sm'`
and adjust the wrapper `.host-row` size accordingly).

- [ ] **Step 2: Create the barrel**

Write `src/app/shared/ui/room-presence-banner/index.ts` with the single re-export.

- [ ] **Step 3: Typecheck**

Run: `cd JilaliTalk-angular-frontend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd JilaliTalk-angular-frontend
git add src/app/shared/ui/room-presence-banner/
git commit -m "feat(shared): add RoomPresenceBannerComponent

Dumb presentational component for the UserInfoModal room-presence
banner. Inputs: presence (UserPresence | null) and hostInfo (UserInfo
| null). Output: (join)='{visible: boolean}'. Renders nothing when
presence is null, blackened, or statusType is 0 (offline). Shows
host row only for statusType=2 (guest in someone else's room);
statusType=1 (hosting own) reuses the modal-target user's own
identity so no host row needed."
```

---

### Task 3: Wire banner into `UserInfoModalComponent`

The modal already has `presence` and `presenceLabel` computeds from `c0da2dd`. Add:
1. The banner import + template usage.
2. An effect that fetches the host's `UserInfo` when `presence.statusType === 2`.
3. A `joinRoom(visible: boolean)` method that closes the dialog and navigates.

**Files:**
- Modify: `src/app/shared/ui/user-info-modal/user-info-modal.component.ts`
- Modify: `src/app/shared/ui/user-info-modal/index.ts` (optional — only if you want
  external callers to be able to import the banner; the modal imports it directly so
  this is optional).

**Interfaces:**
- Consumes: `RoomPresenceBannerComponent` (Task 2), `cnameToBusiType()` (Task 1),
  existing `UserInfoService`, `Router`, `DialogRef`, `UserPresence`, `UserInfo`.
- Produces: nothing externally — this is internal wiring. The banner's `(join)` event
  feeds `modal.joinRoom(visible)`.

**Implementation (additions to `user-info-modal.component.ts`):**

**Step A: Add imports**

Add near the existing top imports:
```ts
import { effect, inject as injectRouter, Router } from '@angular/router';  // Router already imported
import { RoomPresenceBannerComponent } from '@shared/ui/room-presence-banner';
import { cnameToBusiType } from '@shared/utils';
import type { UserInfo } from '@core/services/user-info.service';
```
(`Router` is already imported in the modal — verify before adding. If `effect` isn't
already imported in this file, add it to the existing `@angular/core` import line.)

**Step B: Add `joinRoom` and host-fetch effect inside the class**

Place inside `UserInfoModalComponent` class, after the existing `toggleFollow` method:

```ts
private readonly router = inject(Router);
private readonly isJoining = signal(false);

readonly hostInfo = computed<UserInfo | null>(() => {
  const p = this.presence();
  if (!p || p.statusType !== 2 || p.hostId <= 0) return null;
  if (p.hostId === this.data.userId) return null;  // safety: should never match but
                                                    // guards against host == self case
  return this.userInfoService.getUserInfo(p.hostId);
});

constructor() {
  // ... existing constructor body ...
  // When presence says we're in someone else's room (statusType=2), fetch the host's
  // profile on demand. Reuses the existing 5-minute userInfoService cache.
  effect(() => {
    const p = this.presence();
    if (p?.statusType === 2 && p.hostId > 0 && p.hostId !== this.data.userId) {
      void this.userInfoService.fetchUserInfo(p.hostId);
    }
  });
}

async joinRoom(visible: boolean): Promise<void> {
  if (this.isJoining()) return;                  // re-entry guard
  const p = this.presence();
  if (!p?.cname) return;
  const busiType = cnameToBusiType(p.cname);
  if (busiType === null) return;                 // unknown prefix — refuse
  this.isJoining.set(true);
  try {
    this.ref.close();                            // close modal first so the room page
                                                // mounts cleanly
    const path = busiType === 1 ? '/room/video' : '/room';
    const queryParams = visible ? {} : { visible: 'false' };
    await this.router.navigate([path, p.cname, busiType], { queryParams });
  } finally {
    this.isJoining.set(false);
  }
}
```

**Step C: Render the banner in the template**

Find the template's `<!-- between identity-card and bio -->` region. Insert this
immediately after the closing `</div>` of `<app-user-identity-card>`'s wrapper
(after line ~86 of the current template):

```html
<app-room-presence-banner
  [presence]="presence()"
  [hostInfo]="hostInfo()"
  (join)="joinRoom($event.visible)"
/>
```

- [ ] **Step 1: Add the imports**

Open `user-info-modal.component.ts`, locate the existing import block (around line 1-13).
Add the missing imports. Read the file first to see what's already there — do not
re-add `Router`, `effect`, or any other symbols already imported.

- [ ] **Step 2: Add the `hostInfo` computed and `joinRoom` method**

Insert after the existing `toggleFollow()` method (find it via
`grep -n "async toggleFollow"`). Use the exact code in Step B above. Read the file
first to confirm where to anchor; the existing `toggleFollow` block ends with a
`finally` brace that closes the method — anchor immediately after that.

- [ ] **Step 3: Add the host-fetch effect in the constructor**

Open the existing `constructor()` method. Append the new `effect(() => {...})` block
after whatever the last statement is — do not nest inside the existing `fetchUserPresence`
call. **Read the file first** to confirm the constructor's current shape.

- [ ] **Step 4: Render the banner in the template**

Find the line that closes `<app-user-identity-card>`'s parent wrapper div. Insert
the `<app-room-presence-banner>` element right after that closing div, before
`@if (canFollow())`.

- [ ] **Step 5: Typecheck**

Run: `cd JilaliTalk-angular-frontend && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd JilaliTalk-angular-frontend
git add src/app/shared/ui/user-info-modal/user-info-modal.component.ts
git commit -m "feat(user-info-modal): wire room-presence banner with join actions

Inserts the new RoomPresenceBannerComponent between identity-card and
bio. Adds a hostInfo computed (lazy-fetches host's UserInfo when
presence.statusType===2 via an effect that watches presence), and a
joinRoom(visible) method that closes the dialog, computes the route
from cname via cnameToBusiType(), and navigates with the right
?visible= query param. Re-entry guarded via isJoining signal so
double-clicks don't double-navigate.

Suppresses the inline 'Hosting: <room>' / 'In: <room>' chip from
c0da2dd when the banner is rendered — duplicate surface, banner
takes over."
```

(The chip-suppression bit is in the next task — keep it scoped here to avoid
mixing concerns.)

---

### Task 4: Suppress the inline presence chip when banner is visible

The `c0da2dd` chip and the new banner both show "Hosting: <room>" / "In: <room>".
When the banner renders, the chip becomes a duplicate. Hide the chip in the
template when `shouldShowBanner` is true.

**Files:**
- Modify: `src/app/shared/ui/user-info-modal/user-info-modal.component.ts`

**Interfaces:** none new.

**Implementation:**

Find the existing `presenceLabel` computed. Change it (or add a sibling computed) so
it returns `null` when the banner would render:

```ts
// Existing:
readonly presenceLabel = computed(() => {
  const p = this.presence();
  if (!p || p.blackened) return null;
  if (p.statusType === 1) { ... }
  if (p.statusType === 2) { ... }
  return null;
});
```

Change to:

```ts
readonly shouldShowBanner = computed(() => {
  const p = this.presence();
  return !!p && !p.blackened && (p.statusType === 1 || p.statusType === 2);
});

readonly presenceLabel = computed(() => {
  if (this.shouldShowBanner()) return null;  // banner takes over when present
  const p = this.presence();
  if (!p || p.blackened) return null;
  if (p.statusType === 1) {
    return p.roomName?.trim() ? `Hosting: ${p.roomName}` : 'Hosting a room';
  }
  if (p.statusType === 2) {
    return p.roomName?.trim() ? `In: ${p.roomName}` : 'In a room';
  }
  return null;
});
```

Also update the `<app-room-presence-banner>` `*shouldShow` is the same logic — keep
the banner's internal `shouldShow` as-is (single source of truth is the modal's
banner, which already computes it locally).

- [ ] **Step 1: Add `shouldShowBanner` and update `presenceLabel`**

Edit `user-info-modal.component.ts` per the code above. **Read the file first** to
locate the exact line of the existing `presenceLabel` computed (search for
`readonly presenceLabel`).

- [ ] **Step 2: Verify typecheck + grep for residual chip display**

Run:
```bash
cd JilaliTalk-angular-frontend && npx tsc --noEmit -p tsconfig.json
grep -n "presenceLabel()" src/app/shared/ui/user-info-modal/user-info-modal.component.ts
```
Expected: exit 0, and exactly one `presenceLabel()` reference (in the template) plus the
new computed declaration.

- [ ] **Step 3: Commit**

```bash
cd JilaliTalk-angular-frontend
git add src/app/shared/ui/user-info-modal/user-info-modal.component.ts
git commit -m "fix(user-info-modal): suppress inline presence chip when banner shows

The c0da2dd 'Hosting: <room>' chip and the new banner carry the same
information — when the banner is rendered (statusType ∈ {1,2},
not blackened), the chip becomes a duplicate. Make presenceLabel
return null in that case so the meta-row hides it. Banner stays the
single surface for presence text."
```

---

### Task 5: End-to-end verification

Drive the full flow against a running dev server + BFF. The user-info modal must
render the banner when the modal-target user is in a room, fetch the host's avatar,
and route correctly when Join buttons are clicked.

**Pre-conditions:**
- Dev server running (`npm start` from `JilaliTalk-angular-frontend/`)
- BFF running (the one started in the prior session — or restart via `./gradlew run`)
- Both are at the latest commits

**Files:** none modified — this task is purely verification.

- [ ] **Step 1: Seed a known online state**

Pick a modal-target uid whose `/users/{id}/status` returns `statusType=2` in the live
BFF. Use the BFF default-token fallback (no `Authorization` header needed):

```bash
curl -sS http://localhost:8080/api/users/<someUid>/status | python3 -m json.tool
```

If the only available IDs return statusType=0, log into a real voice room via the iOS
app, find the cname from `/api/rooms/{type}/search` or similar, and use that
participant's uid.

- [ ] **Step 2: Open the modal in the browser**

Navigate to any UI surface that opens `UserInfoModalComponent` for that uid — e.g. open
the notifications panel, click a `profile_visit` entry that points to that uid (or click
an audience member from a room you're in, if you're already in one). Verify visually:

  - [ ] Banner renders below the identity card, above bio
  - [ ] Header label reads "In room" (statusType=2) or "Hosting" (statusType=1)
  - [ ] Room name is shown; falls back to "In a room" / "Hosting a room" if roomName empty
  - [ ] For statusType=2: host row shows avatar + name + country flag
  - [ ] For statusType=1: no host row (we already show the modal-target's own avatar in identity-card)
  - [ ] Two CTA buttons present: "Join Visible" (primary), "Join as Guest" (soft-neutral)
  - [ ] Inline presence chip is **not** rendered (the `presenceLabel` null-guard worked)

- [ ] **Step 3: Click "Join Visible"**

Expected: dialog closes, route changes to `/room/{cname}/{busiType}` (voice) or
`/room/video/{cname}/{busiType}` (video). No query param. Room page mounts and the
in-room flow runs normally.

- [ ] **Step 4: Re-open modal, click "Join as Guest"**

Same modal session. Verify the dialog closes and navigates with `?visible=false` in
the URL bar (DevTools). Same room loads, but user joins invisibly (audience contains
self: false; the existing visibility-trace log will fire).

- [ ] **Step 5: Negative — blackened user**

Set up a uid whose `/users/{id}/status` returns `blackened: true` (test account;
or temporarily edit a capture file). Verify the banner does NOT render for that uid,
and the inline chip also stays suppressed.

- [ ] **Step 6: Negative — offline user**

Open the modal for a uid whose `/users/{id}/status` returns `statusType: 0`. Verify
the banner does NOT render and the inline chip is also suppressed (per the design
spec §3 state table).

- [ ] **Step 7: Run full frontend test suite**

```bash
cd JilaliTalk-angular-frontend && npx tsc --noEmit -p tsconfig.json
```
Expected: exit 0, no errors.

- [ ] **Step 8: No commit needed**

This task is verification only. If a finding surfaces during Steps 2-7 that needs a
code change, open a follow-up task (or amend Task 4 if the fix is small).

---

## File-touch summary

| File | Created | Modified |
|---|---|---|
| `src/app/shared/utils/room-busi-type.ts` | ✅ | |
| `src/app/shared/utils/index.ts` | | ✅ (re-export) |
| `src/app/shared/ui/room-presence-banner/room-presence-banner.component.ts` | ✅ | |
| `src/app/shared/ui/room-presence-banner/index.ts` | ✅ | |
| `src/app/shared/ui/user-info-modal/user-info-modal.component.ts` | | ✅ (2 commits: banner wire, chip suppression) |

5 tasks, 4 commits total. Estimated ~210 net lines added across 5 files.