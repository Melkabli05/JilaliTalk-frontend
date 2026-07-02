# Room Header Mobile-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `RoomHeaderComponent` so every interactive element meets a 44px touch-target floor, the identity block (name/topic/room-ID) stops violating that floor and gets a real tap target, connection status has a working tap-to-refresh affordance, the overflow sheet manages focus correctly, safe-area insets actually work on notched iOS devices, and dead code (`goBack`, `.back-btn`, unused `.overflow-grid` CSS) is removed.

**Architecture:** All changes stay inside `RoomHeaderComponent` (`src/app/features/room/feature/room-header/room-header.ts`) plus two small, necessary touches outside it: `src/index.html` (viewport meta tag — required for `env(safe-area-inset-*)` to resolve to non-zero values at all) and one dead-binding removal in `src/app/features/room/pages/room-page.ts`. No new components are created; the room-info panel and overflow-sheet refinements are added as new template blocks and signals within the existing component. `--toolbar-btn-size` collapses into a single 44px value (deleting the `-sm`/`-lg` variants) in the shared `tokens.scss`, since those two tokens are consumed exclusively by files this plan already touches.

**Tech Stack:** Angular 21 (standalone components, signals, zoneless change detection), Vitest + Angular `TestBed` for component tests, `@angular/cdk/clipboard`, `@lucide/angular` icons.

## Global Constraints

- Every interactive element must be ≥44px in both dimensions at every container width (no exceptions, no shrinking below this floor) — this is the spec's explicit requirement and the reason `--toolbar-btn-size-sm` (32px) is deleted rather than kept as a narrow-width fallback.
- No new files/components outside `room-header.ts` except the one new `room-header.spec.ts` test file, and the two small touches to `index.html` / `room-page.ts` called out above.
- Follow the existing codebase convention: single-file Angular components (inline `template` + `styles` array), `ChangeDetectionStrategy.OnPush` (already present, don't remove), no `standalone: true` (implicit default, already absent).
- Preserve every existing input/output name and semantic except `goBack` (removed — confirmed to be an exact duplicate of `leave`, wired to the same `onLeave()` handler, with no template element ever triggering it).
- CSS custom properties only — no hardcoded colors/spacing (already the codebase convention; don't introduce literals where a token exists).
- Desktop/wide layout (≥1024px container width) behavior for the *toolbar actions* (secondary-actions row, mic/cam/hand cluster) is unchanged. The *identity block* (room name/topic/ID) redesign in Task 5 applies at all widths — it strictly improves on the old cramped inline row and there's no reason to keep two code paths for it.

---

### Task 1: Enable safe-area insets app-wide (`viewport-fit=cover`)

**Files:**
- Modify: `src/index.html:7`

**Interfaces:** None — this is a static HTML meta tag with no TypeScript surface.

- [ ] **Step 1: Add `viewport-fit=cover` to the viewport meta tag**

In `src/index.html`, find:

```html
  <meta name="viewport" content="width=device-width, initial-scale=1">
```

Replace with:

```html
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- [ ] **Step 2: Verify the change**

```bash
grep -n "viewport-fit" src/index.html
```

Expected output: `7:  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`

This has no automated test — it's inert until viewed on an actual notched device/simulator, which is covered in Task 8's manual verification.

- [ ] **Step 3: Commit**

```bash
git add src/index.html
git commit -m "fix(shell): add viewport-fit=cover so safe-area insets resolve on notched devices"
```

---

### Task 2: Remove dead code (`goBack`, `.back-btn`, unused `LucideArrowLeft` import)

**Files:**
- Modify: `src/app/features/room/feature/room-header/room-header.ts`
- Modify: `src/app/features/room/pages/room-page.ts`

**Interfaces:**
- Produces: `RoomHeaderComponent` no longer exposes a `goBack` output. Any remaining consumer must use `leave` instead (there is exactly one consumer, fixed in this task).

- [ ] **Step 1: Remove the unused `LucideArrowLeft` import from the icon import list**

In `room-header.ts`, find:

```ts
import {
  LucideArrowLeft,
  LucideCopy,
```

Replace with:

```ts
import {
  LucideCopy,
```

- [ ] **Step 2: Remove `LucideArrowLeft` from the component's `imports` array**

Find:

```ts
  imports: [
    MicButtonComponent,
    TooltipDirective,
    AvSettingsComponent,
    LucideArrowLeft,
    LucideCopy,
```

Replace with:

```ts
  imports: [
    MicButtonComponent,
    TooltipDirective,
    AvSettingsComponent,
    LucideCopy,
```

- [ ] **Step 3: Remove the `goBack` output**

Find:

```ts
  readonly toggleInvisible = output<void>();
  readonly goBack = output<void>();
```

Replace with:

```ts
  readonly toggleInvisible = output<void>();
```

- [ ] **Step 4: Remove the dead `.back-btn` CSS rule**

Find:

```ts
      .cname-text { font-size: var(--text-xs); }
      .back-btn { flex-shrink: 0; }
      .secondary-actions {
```

Replace with:

```ts
      .cname-text { font-size: var(--text-xs); }
      .secondary-actions {
```

- [ ] **Step 5: Remove the dangling `(goBack)` binding in `room-page.ts`**

In `src/app/features/room/pages/room-page.ts`, find:

```ts
              (leave)="onLeave()"
              (goBack)="onLeave()"
```

Replace with:

```ts
              (leave)="onLeave()"
```

- [ ] **Step 6: Verify no remaining references and the app still builds**

```bash
grep -rn "goBack\|LucideArrowLeft\|back-btn" src/app/features/room/
```

Expected output: no matches.

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors related to `room-header.ts` or `room-page.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/room/feature/room-header/room-header.ts src/app/features/room/pages/room-page.ts
git commit -m "chore(room-header): remove dead goBack output and unused back-btn/icon"
```

---

### Task 3: Unify touch targets to a 44px floor (tokens, room-header, mic-button)

**Files:**
- Modify: `src/styles/tokens.scss`
- Modify: `src/app/features/room/feature/room-header/room-header.ts`
- Modify: `src/app/features/room/ui/mic-button.ts`

**Interfaces:**
- Consumes: `--touch-target-min` token (already defined in `tokens.scss:182` as `44px`, untouched by this task).
- Produces: `--toolbar-btn-size` now always resolves to `44px` (previously `38px`, with a `32px` narrow-width override). `--toolbar-btn-size-sm` and `--toolbar-btn-size-lg` no longer exist — grep confirms (see Task research) their only consumers are the two files this task edits.

- [ ] **Step 1: Verify `--toolbar-btn-size-sm`/`-lg` have no other consumers before deleting them**

```bash
grep -rn "toolbar-btn-size" src/ --include=*.ts --include=*.scss
```

Expected: only `mic-button.ts`, `room-header.ts`, and `tokens.scss` itself appear. If any other file appears, stop and re-scope this task — do not delete tokens still in use elsewhere.

- [ ] **Step 2: Collapse the three toolbar-size tokens into one, in `tokens.scss`**

Find:

```scss
  /* Toolbar / icon button sizes */
  --toolbar-btn-size: 38px;
  --toolbar-btn-size-sm: 32px;
  --toolbar-btn-size-lg: 44px;
  --icon-btn-size: 28px;
```

Replace with:

```scss
  /* Toolbar / icon button sizes */
  --toolbar-btn-size: var(--touch-target-min);
  --icon-btn-size: 28px;
```

- [ ] **Step 3: Update the Tailwind `@theme inline` re-export block in the same file**

Find:

```scss
  --toolbar-btn-size:      var(--toolbar-btn-size);
  --toolbar-btn-size-sm:   var(--toolbar-btn-size-sm);
  --toolbar-btn-size-lg:   var(--toolbar-btn-size-lg);
  --icon-btn-size:         var(--icon-btn-size);
```

Replace with:

```scss
  --toolbar-btn-size:      var(--toolbar-btn-size);
  --icon-btn-size:         var(--icon-btn-size);
```

- [ ] **Step 4: Remove the narrow-width button-shrink rule and two other dead rules in `room-header.ts`**

Find:

```ts
      @container room-header (max-width: 699.98px) {
        .toolbar-btn {
          width: var(--toolbar-btn-size-sm);
          height: var(--toolbar-btn-size-sm);
        }
        .header-left { gap: var(--space-1); }
        .room-topic { max-width: 80px; }
        .overflow-grid { grid-template-columns: repeat(3, 1fr); }
      }
```

Replace with:

```ts
      @container room-header (max-width: 699.98px) {
        .header-left { gap: var(--space-1); }
      }
```

(`.room-topic` is removed entirely in Task 5, so this width override for it would become dead code — deleting it now avoids a temporary orphan. `.overflow-grid` was already dead — grep confirms it's never used as a class in the template — so this also removes pre-existing dead CSS discovered while touching this block.)

- [ ] **Step 5: Bump toolbar icon size from 16px to 18px to stay visually proportional in the larger 44px button**

In `room-header.ts`, replace every occurrence of `[size]="16"` with `[size]="18"`:

```
old_string: [size]="16"
new_string: [size]="18"
replace_all: true
```

- [ ] **Step 6: Remove the mic button's narrow-width shrink and its now-unused container-query setup**

In `mic-button.ts`, find:

```ts
  styles: [`
    /* Container queries: room-header decides the slot width; the mic
       shrinks on narrow slots via @container, not the viewport. */
    :host {
      display: inline-flex;
      container-type: inline-size;
      container-name: mic-button;
    }
```

Replace with:

```ts
  styles: [`
    :host {
      display: inline-flex;
    }
```

Then find:

```ts
    @container mic-button (max-width: 699.98px) {
      .mic-btn {
        width: var(--toolbar-btn-size-sm);
        height: var(--toolbar-btn-size-sm);
      }
    }
  `]
```

Replace with:

```ts
  `]
```

- [ ] **Step 7: Bump the mic button's own icon size from 16px to 18px**

In `mic-button.ts`:

```
old_string: [size]="16"
new_string: [size]="18"
replace_all: true
```

- [ ] **Step 8: Verify — build, stylelint, and confirm no remaining references to the deleted tokens**

```bash
grep -rn "toolbar-btn-size-sm\|toolbar-btn-size-lg" src/
```

Expected: no matches.

```bash
npm run lint:styles
npx tsc --noEmit -p tsconfig.json
```

Expected: both pass with no errors.

- [ ] **Step 9: Commit**

```bash
git add src/styles/tokens.scss src/app/features/room/feature/room-header/room-header.ts src/app/features/room/ui/mic-button.ts
git commit -m "fix(room-header): enforce 44px touch-target floor on all toolbar buttons"
```

---

### Task 4: Connection status — working tap-to-refresh + reduced-motion-safe live announcement

**Files:**
- Modify: `src/app/features/room/feature/room-header/room-header.ts`
- Create: `src/app/features/room/feature/room-header/room-header.spec.ts`

**Interfaces:**
- Produces: `RoomHeaderComponent.onStatusClick(): void` — new public method, calls `onRefresh()` (which emits the existing `refresh` output) only when `wsStatus() === 'disconnected'`.

- [ ] **Step 1: Write the failing test file**

Create `src/app/features/room/feature/room-header/room-header.spec.ts`:

```ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Clipboard } from '@angular/cdk/clipboard';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomHeaderComponent } from './room-header';

describe('RoomHeaderComponent', () => {
  let fixture: ComponentFixture<RoomHeaderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RoomHeaderComponent],
      providers: [{ provide: Clipboard, useValue: { copy: vi.fn(() => true) } }],
    });
    fixture = TestBed.createComponent(RoomHeaderComponent);
  });

  describe('connection status', () => {
    it('clicking the status dot while disconnected emits refresh', () => {
      fixture.componentRef.setInput('wsStatus', 'disconnected');
      fixture.detectChanges();
      let refreshed = false;
      fixture.componentInstance.refresh.subscribe(() => (refreshed = true));

      const dot = fixture.nativeElement.querySelector('.ws-status') as HTMLElement;
      dot.click();

      expect(refreshed).toBe(true);
    });

    it('clicking the status dot while connected does not emit refresh', () => {
      fixture.componentRef.setInput('wsStatus', 'connected');
      fixture.detectChanges();
      let refreshed = false;
      fixture.componentInstance.refresh.subscribe(() => (refreshed = true));

      const dot = fixture.nativeElement.querySelector('.ws-status') as HTMLElement;
      dot.click();

      expect(refreshed).toBe(false);
    });

    it('clicking the status dot while reconnecting does not emit refresh', () => {
      fixture.componentRef.setInput('wsStatus', 'reconnecting');
      fixture.detectChanges();
      let refreshed = false;
      fixture.componentInstance.refresh.subscribe(() => (refreshed = true));

      const dot = fixture.nativeElement.querySelector('.ws-status') as HTMLElement;
      dot.click();

      expect(refreshed).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx ng test --include='**/room-header.spec.ts' --watch=false
```

Expected: FAIL — clicking `.ws-status` currently has no click handler, so `refreshed` stays `false` in the first test.

- [ ] **Step 3: Wire the click handler and live-region markup in the template**

In `room-header.ts`, find:

```ts
        <div
          class="ws-status"
          [class.ws-connected]="wsStatus() === 'connected'"
          [class.ws-reconnecting]="wsStatus() === 'reconnecting'"
          [class.ws-connecting]="wsStatus() === 'connecting'"
          [class.ws-disconnected]="wsStatus() === 'disconnected'"
          [appTooltip]="wsTooltip()"
          tooltipPosition="right"
          aria-label="WebSocket connection status"
        ></div>
```

Replace with:

```ts
        <div
          class="ws-status"
          [class.ws-connected]="wsStatus() === 'connected'"
          [class.ws-reconnecting]="wsStatus() === 'reconnecting'"
          [class.ws-connecting]="wsStatus() === 'connecting'"
          [class.ws-disconnected]="wsStatus() === 'disconnected'"
          [class.ws-tappable]="wsStatus() === 'disconnected'"
          [appTooltip]="wsTooltip()"
          tooltipPosition="right"
          [attr.role]="wsStatus() === 'disconnected' ? 'button' : null"
          [attr.tabindex]="wsStatus() === 'disconnected' ? 0 : null"
          [attr.aria-label]="wsStatus() === 'disconnected' ? 'Disconnected — tap to refresh' : 'WebSocket connection status'"
          (click)="onStatusClick()"
          (keydown.enter)="onStatusClick()"
        ></div>
        <span class="visually-hidden" aria-live="polite">{{ wsTooltip() }}</span>
```

- [ ] **Step 4: Add the `onStatusClick()` method**

Find:

```ts
  onRefresh(): void {
    this.refresh.emit();
  }
```

Replace with:

```ts
  onRefresh(): void {
    this.refresh.emit();
  }
  onStatusClick(): void {
    if (this.wsStatus() === 'disconnected') {
      this.onRefresh();
    }
  }
```

- [ ] **Step 5: Add the tappable-state CSS**

Find:

```ts
      .ws-disconnected { background: var(--rh-ws-disconnected); }

      @keyframes pulse {
```

Replace with:

```ts
      .ws-disconnected { background: var(--rh-ws-disconnected); }
      .ws-status.ws-tappable { cursor: pointer; }
      .ws-status.ws-tappable:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }

      @keyframes pulse {
```

- [ ] **Step 6: Run the test again to verify it passes**

```bash
npx ng test --include='**/room-header.spec.ts' --watch=false
```

Expected: PASS — all three tests in the `connection status` block pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/room/feature/room-header/room-header.ts src/app/features/room/feature/room-header/room-header.spec.ts
git commit -m "fix(room-header): wire tap-to-refresh on disconnected status dot, add aria-live announcement"
```

---

### Task 5: Room identity — replace the cramped inline name/topic/ID row with a tap-to-open info panel

**Files:**
- Modify: `src/app/features/room/feature/room-header/room-header.ts`

**Interfaces:**
- Consumes: existing `name`, `topic`, `cname`, `invisible` inputs; existing `copyCname()`, `onToggleInvisible()`, `visibilityTooltip()` members (all already present, untouched).
- Produces: `showRoomInfo: WritableSignal<boolean>`, `toggleRoomInfo(): void`, `closeRoomInfo(): void` — new public members. Removes `shortCname` computed (no longer used — the panel shows the full, untruncated room ID).

- [ ] **Step 1: Write the failing tests**

Append to `room-header.spec.ts`, inside the existing `describe('RoomHeaderComponent', ...)` block, after the `connection status` block:

```ts
  describe('room info panel', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('name', 'Friday Night Talk');
      fixture.componentRef.setInput('topic', 'Chill vibes only');
      fixture.componentRef.setInput('cname', 'VR_1_42');
      fixture.detectChanges();
    });

    it('is closed by default', () => {
      expect(fixture.nativeElement.querySelector('.room-info-panel')).toBeNull();
    });

    it('opens when the room name is tapped, showing the full topic', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.room-info-panel')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.room-info-value')?.textContent.trim()).toBe(
        'Chill vibes only',
      );
    });

    it('shows the full room id, not truncated', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.cname-text')?.textContent.trim()).toBe('VR_1_42');
    });

    it('copies the room id when the copy row is tapped', () => {
      const clipboard = TestBed.inject(Clipboard);
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      const copyBtn = fixture.nativeElement.querySelector('.room-info-copy') as HTMLElement;
      copyBtn.click();

      expect(clipboard.copy).toHaveBeenCalledWith('VR_1_42');
    });

    it('closes when the backdrop is clicked', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.info-backdrop') as HTMLElement;
      backdrop.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.room-info-panel')).toBeNull();
    });

    it('closes on Escape', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.room-info-panel')).toBeNull();
    });

    it('emits toggleInvisible when the visibility row is tapped', () => {
      let toggled = false;
      fixture.componentInstance.toggleInvisible.subscribe(() => (toggled = true));
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      const visBtn = fixture.nativeElement.querySelector('.room-info-visibility') as HTMLElement;
      visBtn.click();

      expect(toggled).toBe(true);
    });
  });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx ng test --include='**/room-header.spec.ts' --watch=false
```

Expected: FAIL — `.room-name-btn`, `.room-info-panel`, `.room-info-copy`, `.info-backdrop`, `.room-info-visibility` don't exist yet.

- [ ] **Step 3: Replace the identity template block**

Find (this is the block right after the `.ws-status` div edited in Task 4, through the end of the invisible/visible badge button):

```ts
        <div class="room-meta">
          <div class="room-title-row">
            <div class="name-wrapper">
              <h1 class="room-name">{{ name() }}</h1>
            </div>
          </div>
          <div class="room-subtitle">
            <span class="room-topic">{{ topic() }}</span>
            <span class="separator">·</span>
            <span
              class="room-cname"
              (click)="copyCname()"
              [attr.aria-label]="'Copy room ID ' + cname()"
            >
              @if (cnameCopied()) {
                <svg aria-hidden="true" lucideCheck [size]="9"></svg>
              } @else {
                <svg aria-hidden="true" lucideCopy [size]="9"></svg>
              }
              <span class="cname-text">{{ shortCname() }}</span>
            </span>
          </div>
        </div>
        <button
          [class]="invisible() ? 'invisible-badge' : 'visible-badge'"
          class="hide-mobile"
          [appTooltip]="visibilityTooltip()"
          tooltipPosition="bottom"
          [attr.aria-label]="visibilityTooltip()"
          (click)="onToggleInvisible()"
        >
          @if (invisible()) {
            <svg aria-hidden="true" lucideEyeOff [size]="18"></svg>
          } @else {
            <svg aria-hidden="true" lucideEye [size]="18"></svg>
          }
        </button>
```

Replace with:

```ts
        <div class="room-meta">
          <button
            type="button"
            class="room-name-btn"
            [attr.aria-expanded]="showRoomInfo()"
            aria-haspopup="dialog"
            aria-label="Room info"
            (click)="toggleRoomInfo()"
          >
            <h1 class="room-name">{{ name() }}</h1>
          </button>
          @if (showRoomInfo()) {
            <div class="info-backdrop" (click)="closeRoomInfo()"></div>
            <div class="room-info-panel" role="dialog" aria-label="Room info">
              <div class="room-info-row">
                <span class="room-info-label">Topic</span>
                <span class="room-info-value">{{ topic() || 'No topic set' }}</span>
              </div>
              <div class="room-info-row">
                <span class="room-info-label">Room ID</span>
                <button type="button" class="room-info-copy" (click)="copyCname()">
                  <span class="cname-text">{{ cname() }}</span>
                  @if (cnameCopied()) {
                    <svg aria-hidden="true" lucideCheck [size]="16"></svg>
                  } @else {
                    <svg aria-hidden="true" lucideCopy [size]="16"></svg>
                  }
                </button>
              </div>
              <button type="button" class="room-info-visibility" (click)="onToggleInvisible()">
                @if (invisible()) {
                  <svg aria-hidden="true" lucideEyeOff [size]="18"></svg>
                } @else {
                  <svg aria-hidden="true" lucideEye [size]="18"></svg>
                }
                <span>{{ visibilityTooltip() }}</span>
              </button>
            </div>
          }
        </div>
```

(Note: this closing `</div>` for `.room-meta` was missing from the original version of this step — a bug in the plan, not the implementer's fault. `.room-info-panel` must be a DOM descendant of `.room-meta` for its `position: absolute` to anchor under the room name, since `.room-meta` carries `position: relative`.)

(Note: the icon size on the old badge button was already bumped to `18` by Task 3's blanket `16`→`18` replace; this diff reflects that post-Task-3 state.)

- [ ] **Step 4: Add the `showRoomInfo` signal and its methods**

Find:

```ts
  readonly cnameCopied = signal(false);
  readonly showSettings = signal(false);
  readonly showOverflow = signal(false);
```

Replace with:

```ts
  readonly cnameCopied = signal(false);
  readonly showSettings = signal(false);
  readonly showOverflow = signal(false);
  readonly showRoomInfo = signal(false);
```

Find:

```ts
  toggleOverflow(): void {
    this.showOverflow.update((v) => !v);
  }
  closeOverflow(): void {
    this.showOverflow.set(false);
  }
```

Replace with:

```ts
  toggleOverflow(): void {
    this.showOverflow.update((v) => !v);
  }
  closeOverflow(): void {
    this.showOverflow.set(false);
  }
  toggleRoomInfo(): void {
    this.showRoomInfo.update((v) => !v);
  }
  closeRoomInfo(): void {
    this.showRoomInfo.set(false);
  }
```

- [ ] **Step 5: Make Escape close the room-info panel too**

Find:

```ts
  host: {
    '(document:keydown.escape)': 'closeOverflow()',
  },
```

Replace with:

```ts
  host: {
    '(document:keydown.escape)': 'closeOverflow(); closeRoomInfo();',
  },
```

- [ ] **Step 6: Remove the now-unused `shortCname` computed**

Find:

```ts
  readonly shortCname = computed<string>(() => {
    const c = this.cname();
    return c.length > 8 ? c.slice(0, 8) + '…' : c;
  });

  readonly wsTooltip = computed<string>(() => {
```

Replace with:

```ts
  readonly wsTooltip = computed<string>(() => {
```

- [ ] **Step 7: Replace the identity CSS block**

Find (spans from the room-meta comment through the `.secondary-actions` rule — this is the block right after the `.room-cname:hover` dark-mode rule and before the overflow-menu CSS comment):

```ts
      /* ─── Room meta (name + topic + cname) ─────────────────────────── */
      .room-meta {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
        flex: 1;
      }
      .room-title-row {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
      .invisible-badge,
      .visible-badge {
        position: relative;
        width: var(--toolbar-btn-size);
        height: var(--toolbar-btn-size);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-lg);
        border: 1px solid;
        cursor: pointer;
        transition:
          background 0.15s,
          color 0.15s,
          border-color 0.15s,
          box-shadow 0.15s,
          transform 0.12s;
        flex-shrink: 0;
        -webkit-user-select: none;
        user-select: none;
      }
      .invisible-badge:hover,
      .visible-badge:hover { box-shadow: var(--shadow-sm); }
      .invisible-badge:active,
      .visible-badge:active { transform: scale(0.92); }

      .invisible-badge {
        color: var(--rh-btn-warm-fg);
        background: var(--rh-btn-warm-bg);
        border-color: var(--rh-btn-warm-hover-border);
      }
      .invisible-badge:hover {
        background: var(--rh-btn-warm-hover-bg);
        border-color: var(--color-warm-300);
      }
      :host-context(.dark) .invisible-badge:hover {
        border-color: var(--color-warm-600);
      }

      .visible-badge {
        color: var(--rh-btn-primary-fg);
        background: var(--rh-btn-primary-bg);
        border-color: var(--rh-btn-primary-hover-border);
      }
      .visible-badge:hover {
        background: var(--rh-btn-primary-hover-bg);
        border-color: var(--color-primary-300);
      }
      :host-context(.dark) .visible-badge:hover {
        border-color: var(--color-primary-600);
      }

      .name-wrapper { overflow: hidden; flex: 1; }
      .room-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--rh-text);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .room-subtitle {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
      .room-topic {
        font-size: var(--text-xs);
        color: var(--rh-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
      }
      .separator {
        font-size: var(--text-xs);
        color: var(--rh-text-muted);
      }
      .room-cname {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        font-size: var(--text-xs);
        color: var(--rh-text-muted);
        cursor: pointer;
        font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
        padding: 1px 4px;
        border-radius: var(--radius-sm);
        transition: background 0.15s, color 0.15s;
        -webkit-user-select: none;
        user-select: none;
      }
      .room-cname:hover {
        background: var(--color-neutral-100);
        color: var(--color-primary-500);
      }
      :host-context(.dark) .room-cname:hover {
        background: var(--color-neutral-700);
        color: var(--color-primary-400);
      }
      .cname-text { font-size: var(--text-xs); }
      .secondary-actions {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
```

Replace with:

```ts
      /* ─── Room identity (name + tap-to-open info panel) ─────────────── */
      .room-meta {
        position: relative;
        display: flex;
        min-width: 0;
        flex: 1;
      }
      .room-name-btn {
        display: flex;
        align-items: center;
        min-width: 0;
        max-width: 100%;
        padding: var(--space-1) var(--space-2);
        margin: 0 calc(var(--space-2) * -1);
        border: none;
        border-radius: var(--radius-md);
        background: none;
        cursor: pointer;
        transition: background 0.15s;
        -webkit-user-select: none;
        user-select: none;
      }
      .room-name-btn:hover,
      .room-name-btn[aria-expanded='true'] {
        background: var(--color-neutral-100);
      }
      :host-context(.dark) .room-name-btn:hover,
      :host-context(.dark) .room-name-btn[aria-expanded='true'] {
        background: var(--color-neutral-700);
      }
      .room-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--rh-text);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .info-backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--z-overlay);
        background: transparent;
      }
      .room-info-panel {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: calc(var(--z-overlay) + 1);
        width: max-content;
        min-width: 220px;
        max-width: min(320px, 90vw);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--rh-bg);
        border: 1px solid var(--rh-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-dropdown);
        animation: panel-fade-in 0.15s ease-out;
      }
      @keyframes panel-fade-in {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .room-info-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .room-info-label {
        font-size: var(--text-2xs);
        font-weight: var(--font-medium);
        color: var(--rh-text-muted);
        text-transform: uppercase;
        letter-spacing: var(--letter-spacing-wide);
      }
      .room-info-value {
        font-size: var(--text-sm);
        color: var(--rh-text);
        word-break: break-word;
      }
      .room-info-copy {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        min-height: var(--touch-target-min);
        padding: 0 var(--space-2);
        margin: 0 calc(var(--space-2) * -1);
        border: none;
        border-radius: var(--radius-md);
        background: none;
        cursor: pointer;
        color: var(--rh-text);
        font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
        font-size: var(--text-sm);
        transition: background 0.15s, color 0.15s;
      }
      .room-info-copy:hover {
        background: var(--color-neutral-100);
        color: var(--color-primary-500);
      }
      :host-context(.dark) .room-info-copy:hover {
        background: var(--color-neutral-700);
        color: var(--color-primary-400);
      }
      .cname-text { flex: 1; text-align: left; overflow-wrap: anywhere; }

      .room-info-visibility {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: var(--touch-target-min);
        padding: 0 var(--space-2);
        margin: 0 calc(var(--space-2) * -1);
        border: none;
        border-top: 1px solid var(--rh-border);
        border-radius: var(--radius-md);
        background: none;
        cursor: pointer;
        color: var(--rh-btn-warm-fg);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        transition: background 0.15s;
      }
      .room-info-visibility:hover {
        background: var(--rh-btn-warm-bg);
      }
      .secondary-actions {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
```

- [ ] **Step 8: Remove the now-dead `.room-subtitle` narrow-width rule**

Find:

```ts
      @container room-header (max-width: 479.98px) {
        .room-subtitle { display: none; }
      }
```

Replace with: (delete the block entirely — remove these three lines, leaving nothing in their place)

- [ ] **Step 9: Run the tests to verify they pass**

```bash
npx ng test --include='**/room-header.spec.ts' --watch=false
```

Expected: PASS — all `room info panel` tests pass, and the Task 4 `connection status` tests still pass.

- [ ] **Step 10: Full build check**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:styles
```

Expected: both pass with no errors (confirms no stray references to `shortCname`, `.room-subtitle`, `.invisible-badge`, `.visible-badge`, `.room-topic`, `.room-cname` remain).

- [ ] **Step 11: Commit**

```bash
git add src/app/features/room/feature/room-header/room-header.ts src/app/features/room/feature/room-header/room-header.spec.ts
git commit -m "feat(room-header): replace inline name/topic/id row with tap-to-open room info panel"
```

---

### Task 6: Overflow sheet — dialog semantics and focus management

**Files:**
- Modify: `src/app/features/room/feature/room-header/room-header.ts`

**Interfaces:**
- Consumes: existing `showOverflow` signal, `toggleOverflow()`/`closeOverflow()` methods (modified in place, same names/signatures).
- Produces: no new public members. `viewChild` refs `moreBtn`/`overflowPanel` are private implementation detail.

- [ ] **Step 1: Write the failing tests**

Append to `room-header.spec.ts`, after the `room info panel` block:

```ts
  describe('overflow menu accessibility', () => {
    it('has dialog semantics', () => {
      const moreBtn = fixture.nativeElement.querySelector('.toolbar-btn.c-more') as HTMLElement;
      moreBtn.click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.overflow-panel') as HTMLElement;
      expect(panel.getAttribute('role')).toBe('dialog');
      expect(panel.getAttribute('aria-modal')).toBe('true');
    });

    it('moves focus into the panel on open', async () => {
      const moreBtn = fixture.nativeElement.querySelector('.toolbar-btn.c-more') as HTMLElement;
      moreBtn.click();
      fixture.detectChanges();
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      const panel = fixture.nativeElement.querySelector('.overflow-panel') as HTMLElement;
      expect(document.activeElement).toBe(panel);
    });

    it('returns focus to the more-actions button on close', async () => {
      const moreBtn = fixture.nativeElement.querySelector('.toolbar-btn.c-more') as HTMLElement;
      moreBtn.click();
      fixture.detectChanges();
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      fixture.componentInstance.closeOverflow();
      fixture.detectChanges();
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      expect(document.activeElement).toBe(moreBtn);
    });
  });
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx ng test --include='**/room-header.spec.ts' --watch=false
```

Expected: FAIL — `aria-modal` isn't set yet, and no focus management exists.

- [ ] **Step 3: Add `viewChild` imports**

Find:

```ts
import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
```

Replace with:

```ts
import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  DestroyRef,
  ElementRef,
  viewChild,
} from '@angular/core';
```

- [ ] **Step 4: Add template refs on the trigger button and the panel**

Find:

```ts
        <button
          class="toolbar-btn c-more"
          appTooltip="More actions"
          tooltipPosition="bottom"
          aria-label="More actions"
          (click)="toggleOverflow()"
        >
          <svg aria-hidden="true" lucideEllipsisVertical [size]="18"></svg>
        </button>
```

Replace with:

```ts
        <button
          #moreBtn
          class="toolbar-btn c-more"
          appTooltip="More actions"
          tooltipPosition="bottom"
          aria-label="More actions"
          [attr.aria-expanded]="showOverflow()"
          aria-haspopup="dialog"
          (click)="toggleOverflow()"
        >
          <svg aria-hidden="true" lucideEllipsisVertical [size]="18"></svg>
        </button>
```

Find:

```ts
      <div
        class="overflow-panel"
        role="dialog"
        aria-label="More actions"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd($event)"
      >
```

Replace with:

```ts
      <div
        #overflowPanel
        class="overflow-panel"
        role="dialog"
        aria-modal="true"
        aria-label="More actions"
        tabindex="-1"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd($event)"
      >
```

- [ ] **Step 5: Add the view-child signals and wire focus movement into `toggleOverflow`/`closeOverflow`**

Find:

```ts
  toggleOverflow(): void {
    this.showOverflow.update((v) => !v);
  }
  closeOverflow(): void {
    this.showOverflow.set(false);
  }
```

Replace with:

```ts
  private readonly moreBtn = viewChild<ElementRef<HTMLButtonElement>>('moreBtn');
  private readonly overflowPanel = viewChild<ElementRef<HTMLElement>>('overflowPanel');

  toggleOverflow(): void {
    const opening = !this.showOverflow();
    this.showOverflow.set(opening);
    if (opening) {
      queueMicrotask(() => this.overflowPanel()?.nativeElement.focus());
    }
  }
  closeOverflow(): void {
    const wasOpen = this.showOverflow();
    this.showOverflow.set(false);
    if (wasOpen) {
      queueMicrotask(() => this.moreBtn()?.nativeElement.focus());
    }
  }
```

- [ ] **Step 6: Suppress the default focus ring on the programmatically-focused panel container**

Find:

```ts
      .overflow-panel {
        position: fixed;
        bottom: 0;
```

Replace with:

```ts
      .overflow-panel {
        position: fixed;
        bottom: 0;
```

(no change to this rule itself — add a new rule right after the `panel-enter` keyframes instead)

Find:

```ts
      @keyframes panel-enter {
        from {
          opacity: 0;
          transform: translateY(24px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
```

Replace with:

```ts
      @keyframes panel-enter {
        from {
          opacity: 0;
          transform: translateY(24px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .overflow-panel:focus { outline: none; }
```

- [ ] **Step 7: Bump `.icon-btn` (the overflow panel's close button) to the 44px floor — it's local to this component's encapsulated styles, not the shared global token**

Find:

```ts
      .icon-btn {
        width: var(--icon-btn-size);
        height: var(--icon-btn-size);
```

Replace with:

```ts
      .icon-btn {
        width: var(--touch-target-min);
        height: var(--touch-target-min);
```

- [ ] **Step 8: Give overflow rows an explicit 44px floor regardless of content**

Find:

```ts
      .overflow-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        width: 100%;
        padding: var(--space-3) var(--space-2);
        border-radius: var(--radius-lg);
        background: none;
        border: none;
        cursor: pointer;
        color: var(--rh-text);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        text-align: left;
        transition: background 0.12s, color 0.12s, transform 0.1s;
        -webkit-tap-highlight-color: transparent;
        -webkit-user-select: none;
        user-select: none;
      }
```

Replace with:

```ts
      .overflow-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        width: 100%;
        min-height: var(--touch-target-min);
        padding: var(--space-3) var(--space-2);
        box-sizing: border-box;
        border-radius: var(--radius-lg);
        background: none;
        border: none;
        cursor: pointer;
        color: var(--rh-text);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        text-align: left;
        transition: background 0.12s, color 0.12s, transform 0.1s;
        -webkit-tap-highlight-color: transparent;
        -webkit-user-select: none;
        user-select: none;
      }
```

- [ ] **Step 9: Run the tests to verify they pass**

```bash
npx ng test --include='**/room-header.spec.ts' --watch=false
```

Expected: PASS — all tests including the new `overflow menu accessibility` block.

- [ ] **Step 10: Full build check**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint:styles
```

Expected: both pass.

- [ ] **Step 11: Commit**

```bash
git add src/app/features/room/feature/room-header/room-header.ts src/app/features/room/feature/room-header/room-header.spec.ts
git commit -m "feat(room-header): overflow sheet gets dialog semantics and focus management"
```

---

### Task 7: Visual polish (elevation) and reduced-motion verification

**Files:**
- Modify: `src/app/features/room/feature/room-header/room-header.ts`

**Interfaces:** None — pure CSS.

- [ ] **Step 1: Confirm reduced-motion is already handled globally before adding anything**

```bash
grep -n -A8 "prefers-reduced-motion" src/styles/global.scss
```

Expected: a rule forcing `animation-duration: 0.001ms !important` and `transition-duration: 0.001ms !important` on `*, *::before, *::after`. This is a global, `!important`-enforced rule that already neutralizes every animation in `room-header.ts` and `mic-button.ts` (the status pulse, the mic speaking-ring, the panel-enter/fade-in keyframes, the refresh spin) — confirmed by the universal `*` selector, which matches encapsulated component elements too. **No per-component reduced-motion CSS is needed.** This step is a verification, not a code change — if the grep doesn't find this rule, stop and re-scope (something upstream of this plan changed).

- [ ] **Step 2: Add a subtle elevation shadow to the header shell**

Find:

```ts
      .room-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) var(--space-3);
        background: var(--rh-bg);
        border-bottom: 1px solid var(--rh-border);
        gap: var(--space-2);
        height: var(--room-header-height);
        box-sizing: border-box;
      }
```

Replace with:

```ts
      .room-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) var(--space-3);
        background: var(--rh-bg);
        border-bottom: 1px solid var(--rh-border);
        box-shadow: var(--shadow-xs);
        gap: var(--space-2);
        height: var(--room-header-height);
        box-sizing: border-box;
      }
```

- [ ] **Step 3: Run the full test suite for this file to confirm nothing broke**

```bash
npx ng test --include='**/room-header.spec.ts' --watch=false
npm run lint:styles
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/room/feature/room-header/room-header.ts
git commit -m "style(room-header): add subtle elevation shadow to header shell"
```

---

### Task 8: Manual verification in the browser

**Files:** None modified — this task is pure verification, per this codebase's convention that CSS/UX changes need to be seen in a real browser, not just type-checked.

- [ ] **Step 1: Start the dev server**

```bash
npm start
```

Navigate to a room page (any voice/live room route reachable from the app).

- [ ] **Step 2: Verify touch targets at mobile widths**

Using browser devtools device toolbar, set width to 360px (small Android) and 390px (iPhone-class). For every visible header button (status dot when disconnected, mic, hand, more, leave, room-info copy button, overflow rows, overflow close button): open devtools element inspector and confirm computed `width`/`height` are `≥44px`. Confirm no button visibly shrinks compared to a wider width — there should no longer be two different toolbar-button sizes at any width.

- [ ] **Step 3: Verify the room-info panel**

Tap the room name. Confirm: panel opens below the name, shows full topic and full (untruncated) room ID, copy button copies to the real OS clipboard (paste somewhere to confirm), tapping the visibility row toggles invisible mode and the panel's icon/label updates, tapping outside the panel or pressing Escape closes it, and focus visibly returns to a sensible place (not lost to `<body>`).

- [ ] **Step 4: Verify the overflow sheet**

Tap "more actions". Confirm the sheet opens, swipe-down-to-dismiss still works, and using Tab/Shift+Tab (or a screen reader) focus starts inside the panel and doesn't leak to elements behind the backdrop. Close it via the X button and confirm focus visibly returns to the "more actions" button (a visible focus ring should appear there without you pressing Tab again).

- [ ] **Step 5: Verify safe-area insets**

In devtools device toolbar, select an iPhone preset with a notch/Dynamic Island (e.g. "iPhone 14 Pro"). Confirm the overflow sheet's bottom padding clears the home indicator and nothing in the header is visually clipped at the top. If the very top of the header (status dot/name) appears to sit under a simulated notch, add `padding-top: env(safe-area-inset-top, 0px);` to `.room-header` in `room-header.ts` and re-verify — per the design spec, this is a conditional fix only needed if visual verification shows clipping, since the header may already be adequately positioned by the existing `z-index`/layout stacking.

- [ ] **Step 6: Verify dark mode**

Toggle the app's dark theme. Confirm the room-info panel, the tappable status dot, and the new shadow on the header shell all look correct (readable text, visible borders, no washed-out or invisible elements).

- [ ] **Step 7: Verify reduced motion**

In devtools, enable the "prefers-reduced-motion: reduce" emulation (Rendering tab). Confirm the status pulse, mic speaking-ring, and panel-open animations are no longer animating (should snap instantly), consistent with the global rule confirmed in Task 7 Step 1.

- [ ] **Step 8: Verify desktop/wide layout is unchanged**

Widen the browser to ≥1024px container width. Confirm the secondary-actions row (gift/pitch/reward/settings/managers/captions) still renders inline as before, and the room name still opens the new info panel (this is the one intentional behavior change at wide widths, per Global Constraints).

No commit for this task — it's verification only. If any step reveals a bug, open a new task/fix following the same TDD pattern as Tasks 1-7 rather than patching ad hoc.

---

## Self-Review Notes

**Spec coverage:** §1 (touch targets, dead code, broken affordance) → Tasks 2, 3, 4. §3 (identity/info panel) → Task 5. §5 (safe area) → Tasks 1, 8. §6 (overflow focus/dialog semantics) → Task 6. §9 (visual polish) → Task 7. §7 already covered by Task 2. Reduced-motion (§9 original spec item) resolved as "already handled" during Task 7 Step 1 investigation rather than needing new code — documented explicitly so the executor doesn't add redundant CSS.

**Type/name consistency check:** `showRoomInfo`/`toggleRoomInfo`/`closeRoomInfo` (Task 5) match across all later references. `onStatusClick` (Task 4) matches its single call site. `moreBtn`/`overflowPanel` view-child names (Task 6) match their template `#ref` names exactly. No task references a signal/method defined in a *later* task.
