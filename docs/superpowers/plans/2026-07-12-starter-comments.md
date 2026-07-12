# Room Comments — Localized Starter Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show 3 tappable, room-language-localized starter-comment chips above the comment-input bar when a user joins a room, so they have a one-tap way to say something instead of a blank input.

**Architecture:** The room's `langId` (already returned by the enter-room API, alongside `topic`) is threaded onto `BaseRoomStore` and passed down to `CommentsPanelComponent`. A new pure util maps `langId` → one of three phrase sets (Arabic / French / English-fallback). A new dumb `StarterCommentsComponent` renders the 3 chips and emits the picked phrase; `CommentsPanelComponent` routes that through its existing `onSendComment` handler, so a chip tap is indistinguishable from a typed send. Visibility is a computed signal derived from whether the current user already has a comment in the room — no manual "seen" flag to keep in sync.

**Tech Stack:** Angular 22 (signals, `input()`/`output()`, `computed()`), SCSS with design tokens, no new dependencies.

## Global Constraints

- No i18n framework — only the 3 phrases' *content* is localized, not app chrome.
- Skip unit tests (user standing instruction) — verify via `tsc -p tsconfig.app.json --noEmit`, `ng build`, and manual browser walkthroughs instead of TDD.
- `ChangeDetectionStrategy.OnPush` on the new component; no `standalone: true` (redundant in this codebase); component styles use design tokens, never hardcoded colors.
- Phrase sets (final, approved in spec):
  - English: `'Hey everyone! 👋'`, `"What's the topic?"`, `'Good vibes only ✨'`
  - French: `'Salut tout le monde ! 👋'`, `"C'est quoi le sujet ?"`, `'Bonne humeur garantie ! 😄'`
  - Arabic: `'مرحبًا بالجميع! 👋'`, `'ما هو الموضوع؟'`, `'تحياتي 🌹'`
- Language mapping: `langId` 13 or 13001 → Arabic; 8 or 8001 → French; everything else (including 1/English) → English.

---

### Task 1: Add `langId` to `BaseRoomStore`

**Files:**
- Modify: `src/app/features/room/store/base-room-store.ts:53` (signal declarations), `:70` (readonly exports), `:213` (reset block inside `leaveRoom()`), `:232` (setters)

Note: the spec (`docs/superpowers/specs/2026-07-12-starter-comments-design.md` §5) says this mirrors `RoomStore`'s `topic`/`setRoomTopic` pair. Verified during planning that `topic` actually lives on `BaseRoomStore` (which `RoomStore` extends, shared by both `room-page` and `video-room-page`), not on `RoomStore` itself — this task follows that same location so `langId` is available to both room types identically, matching the spec's intent exactly.

**Interfaces:**
- Produces: `BaseRoomStore.langId: Signal<number>` (default `1`), `BaseRoomStore.setRoomLanguage(langId: number): void`. Task 2 calls the setter; Task 5/6 read the signal.

- [ ] **Step 1: Add the private signal next to `_topic`**

In `base-room-store.ts`, find:
```ts
  private readonly _name = signal<string>('');
  private readonly _topic = signal<string>('');
```
Change to:
```ts
  private readonly _name = signal<string>('');
  private readonly _topic = signal<string>('');
  private readonly _langId = signal<number>(1);
```

- [ ] **Step 2: Expose the readonly signal next to `topic`**

Find:
```ts
  readonly name = this._name.asReadonly();
  readonly topic = this._topic.asReadonly();
  readonly userId = this._userId.asReadonly();
```
Change to:
```ts
  readonly name = this._name.asReadonly();
  readonly topic = this._topic.asReadonly();
  readonly langId = this._langId.asReadonly();
  readonly userId = this._userId.asReadonly();
```

- [ ] **Step 3: Reset it in `leaveRoom()` alongside `_topic`**

Find (inside `leaveRoom()`):
```ts
    this._name.set('');
    this._topic.set('');
    this._userId.set(0);
```
Change to:
```ts
    this._name.set('');
    this._topic.set('');
    this._langId.set(1);
    this._userId.set(0);
```

- [ ] **Step 4: Add the setter next to `setRoomTopic`**

Find:
```ts
  setRoomName(name: string): void { this._name.set(name); }
  setRoomTopic(topic: string): void { this._topic.set(topic); }
}
```
Change to:
```ts
  setRoomName(name: string): void { this._name.set(name); }
  setRoomTopic(topic: string): void { this._topic.set(topic); }
  setRoomLanguage(langId: number): void { this._langId.set(langId); }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/room/store/base-room-store.ts
git commit -m "feat(room): add langId to BaseRoomStore, mirroring the topic field"
```

---

### Task 2: Set the room language on entry (voice + video/live)

**Files:**
- Modify: `src/app/features/room/commands/enter-room.command.ts:138` (voice entry), `:317` (live/video entry)

**Interfaces:**
- Consumes: `roomStore.setRoomLanguage(langId: number): void` from Task 1.
- Consumes: `channelInfo.langId: number` — already present on the API response type (`src/app/features/room/models/room-model.ts:390`), currently unused by this command.

- [ ] **Step 1: Set language on voice-room entry**

In `enter-room.command.ts`, find:
```ts
  const ch = voiceInfo.channelInfo;
  roomStore.setCname(cname);
  roomStore.setRoomName(ch?.name?.trim() ?? '');
  roomStore.setRoomTopic(ch?.topic ?? '');
```
Change to:
```ts
  const ch = voiceInfo.channelInfo;
  roomStore.setCname(cname);
  roomStore.setRoomName(ch?.name?.trim() ?? '');
  roomStore.setRoomTopic(ch?.topic ?? '');
  roomStore.setRoomLanguage(ch?.langId ?? 1);
```

- [ ] **Step 2: Set language on video/live-room entry**

Find:
```ts
  const ch = liveInfo.channelInfo;
  const actualCname = ch?.cname || cname;
  roomStore.setCname(actualCname);
  roomStore.setRoomName(ch?.name?.trim() ?? '');
  roomStore.setRoomTopic(ch?.topic ?? '');
```
Change to:
```ts
  const ch = liveInfo.channelInfo;
  const actualCname = ch?.cname || cname;
  roomStore.setCname(actualCname);
  roomStore.setRoomName(ch?.name?.trim() ?? '');
  roomStore.setRoomTopic(ch?.topic ?? '');
  roomStore.setRoomLanguage(ch?.langId ?? 1);
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.
Run: `npx ng build --configuration development 2>&1 | grep -iE "error" | grep -v "ht-im-connection\|im-socket\|ImSocketService\|imSocket"`
Expected: no output (pre-existing unrelated `ht-im-connection`/`im-socket` errors from other in-progress work are not caused by this change and are excluded from this check).

- [ ] **Step 4: Commit**

```bash
git add src/app/features/room/commands/enter-room.command.ts
git commit -m "feat(room): set room language from channelInfo on entry"
```

---

### Task 3: Create the language → phrase-set util

**Files:**
- Create: `src/app/features/room/comments/starter-comments.util.ts`

**Interfaces:**
- Produces: `getStarterComments(langId: number): readonly string[]`. Task 4 consumes this.

- [ ] **Step 1: Write the util**

Create `src/app/features/room/comments/starter-comments.util.ts`:
```ts
const ENGLISH = [
  'Hey everyone! 👋',
  "What's the topic?",
  'Good vibes only ✨',
] as const;

const FRENCH = [
  'Salut tout le monde ! 👋',
  "C'est quoi le sujet ?",
  'Bonne humeur garantie ! 😄',
] as const;

const ARABIC = [
  'مرحبًا بالجميع! 👋',
  'ما هو الموضوع؟',
  'تحياتي 🌹',
] as const;

export function getStarterComments(langId: number): readonly string[] {
  if (langId === 13 || langId === 13001) return ARABIC;
  if (langId === 8 || langId === 8001) return FRENCH;
  return ENGLISH;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/room/comments/starter-comments.util.ts
git commit -m "feat(room): add language-to-starter-phrases mapping util"
```

---

### Task 4: Create `StarterCommentsComponent`

**Files:**
- Create: `src/app/features/room/comments/starter-comments.ts`

**Interfaces:**
- Consumes: `getStarterComments(langId: number): readonly string[]` from Task 3.
- Produces: `StarterCommentsComponent` with `langId = input<number>(1)`, `disabled = input(false)`, `pick = output<string>()`. Task 5 consumes this component and its `pick` output.

- [ ] **Step 1: Write the component**

Create `src/app/features/room/comments/starter-comments.ts`:
```ts
import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { getStarterComments } from './starter-comments.util';

@Component({
  selector: 'app-starter-comments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="starter-comments" role="group" aria-label="Suggested messages">
      @for (phrase of phrases(); track phrase) {
        <button
          type="button"
          class="starter-chip"
          [disabled]="sending() || disabled()"
          (click)="onPick(phrase)"
        >{{ phrase }}</button>
      }
    </div>
  `,
  styles: [`
    .starter-comments {
      display: flex;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .starter-comments::-webkit-scrollbar { display: none; }

    .starter-chip {
      flex-shrink: 0;
      white-space: nowrap;
      padding: 6px var(--space-3);
      border-radius: var(--radius-full);
      border: 1px solid var(--color-border);
      background: var(--color-card);
      color: var(--color-primary-600);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      cursor: pointer;
    }
    :host-context(.dark) .starter-chip { color: var(--color-primary-300); }
    .starter-chip:disabled { opacity: 0.5; cursor: default; }
    .starter-chip:active:not(:disabled) { transform: scale(0.96); }
    .starter-chip:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
  `],
})
export class StarterCommentsComponent {
  readonly langId = input<number>(1);
  readonly disabled = input(false);
  readonly pick = output<string>();

  protected readonly phrases = computed(() => getStarterComments(this.langId()));
  protected readonly sending = signal(false);

  onPick(phrase: string): void {
    if (this.sending() || this.disabled()) return;
    this.sending.set(true);
    this.pick.emit(phrase);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/room/comments/starter-comments.ts
git commit -m "feat(room): add StarterCommentsComponent"
```

---

### Task 5: Wire starter comments into `CommentsPanelComponent`

**Files:**
- Modify: `src/app/features/room/comments/comments-panel.ts`

**Interfaces:**
- Consumes: `StarterCommentsComponent` (Task 4), `SendEvent` type (already imported in this file from `./comment-input`).
- Produces: `CommentsPanelComponent.langId = input<number>(1)`. Task 6 binds this from the page templates.

- [ ] **Step 1: Import the new component**

In `comments-panel.ts`, find:
```ts
import { Tabs, TabList, Tab, TabPanel, TabContent } from '@angular/aria/tabs';
import { CommentListComponent } from './comment-list';
import { CommentInputComponent, ReplyTarget, SendEvent } from './comment-input';
import { CaptionListComponent } from './caption-list';
```
Change to:
```ts
import { Tabs, TabList, Tab, TabPanel, TabContent } from '@angular/aria/tabs';
import { CommentListComponent } from './comment-list';
import { CommentInputComponent, ReplyTarget, SendEvent } from './comment-input';
import { CaptionListComponent } from './caption-list';
import { StarterCommentsComponent } from './starter-comments';
```

- [ ] **Step 2: Add it to the component's `imports` array**

Find:
```ts
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    CommentListComponent,
    CommentInputComponent,
    CaptionListComponent,
    LucideMessageCircle,
```
Change to:
```ts
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    CommentListComponent,
    CommentInputComponent,
    CaptionListComponent,
    StarterCommentsComponent,
    LucideMessageCircle,
```

- [ ] **Step 3: Render the chips above `app-comment-input`, gated by the new computed**

Find:
```ts
          <app-comment-input
            [replyTo]="replyTo()"
            [disabled]="disabled()"
            (send)="onSendComment($event)"
            (typing)="typing.emit()"
            (cancelReply)="replyTarget.set(null)"
          />
```
Change to:
```ts
          @if (showStarterComments()) {
            <app-starter-comments
              [langId]="langId()"
              [disabled]="disabled()"
              (pick)="onSendComment({ text: $event })"
            />
          }
          <app-comment-input
            [replyTo]="replyTo()"
            [disabled]="disabled()"
            (send)="onSendComment($event)"
            (typing)="typing.emit()"
            (cancelReply)="replyTarget.set(null)"
          />
```

- [ ] **Step 4: Add the `langId` input and `showStarterComments` computed to the class**

Find:
```ts
  readonly comments = input<readonly Comment[]>([]);
  readonly captions = input<readonly import('../models/room-model').CaptionEntry[]>([]);
  readonly currentUserId = input<number>(0);
```
Change to:
```ts
  readonly comments = input<readonly Comment[]>([]);
  readonly captions = input<readonly import('../models/room-model').CaptionEntry[]>([]);
  readonly currentUserId = input<number>(0);
  readonly langId = input<number>(1);
```

Then find:
```ts
  readonly activeTab = signal<string | undefined>('comments');
  readonly replyTarget = signal<Comment | null>(null);
  readonly expanded = signal(false);
```
Change to:
```ts
  readonly activeTab = signal<string | undefined>('comments');
  readonly replyTarget = signal<Comment | null>(null);
  readonly expanded = signal(false);

  /** Visible until the current user's first comment lands in this room
   *  session (via a chip tap or typed manually) — derived from the comment
   *  list itself rather than a separate "seen" flag, so it can't drift. */
  readonly showStarterComments = computed(() =>
    !this.commentsStore.comments().some((c) => c.userId === this.currentUserId()),
  );
```

- [ ] **Step 5: Add styles for the chip row's placement (no CSS change needed beyond what Task 4 already ships in `starter-comments.ts`'s own styles — this step only verifies the surrounding flex layout doesn't need adjustment)**

`app-starter-comments` will be a sibling flex item of `app-comment-input` inside `.tab-panel`'s `ng-template ngTabContent`, which is not itself a flex container (only `.comments-panel`, `.tab-panel`, and `.comments-scroll` are). Find the existing rule:
```ts
      app-comment-input { flex-shrink: 0; }
```
Change to:
```ts
      app-comment-input, app-starter-comments { flex-shrink: 0; }
```
(This mirrors how `app-comment-input` itself is kept from stretching inside the `.tab-panel` flex column — see `.tab-panel { display: flex; flex-direction: column; ... }` a few rules above.)

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.
Run: `npx ng build --configuration development 2>&1 | grep -iE "error" | grep -v "ht-im-connection\|im-socket\|ImSocketService\|imSocket"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/room/comments/comments-panel.ts
git commit -m "feat(room): render starter-comment chips above the comment input"
```

---

### Task 6: Pass `langId` down from both room pages

**Files:**
- Modify: `src/app/features/room/pages/room-page/room-page.html:55-66`, `src/app/features/room/pages/video-room-page/video-room-page.html:57-68`

**Interfaces:**
- Consumes: `roomStore.langId(): Signal<number>` from Task 1, `CommentsPanelComponent`'s `langId` input from Task 5.

- [ ] **Step 1: Bind `langId` in `room-page.html`**

Find:
```html
    <app-comments-panel
      [comments]="commentsStore.comments()"
      [captions]="commentsStore.captions()"
      [currentUserId]="roomStore.userId()"
      [refreshing]="facade.refreshingComments()"
```
Change to:
```html
    <app-comments-panel
      [comments]="commentsStore.comments()"
      [captions]="commentsStore.captions()"
      [currentUserId]="roomStore.userId()"
      [langId]="roomStore.langId()"
      [refreshing]="facade.refreshingComments()"
```

- [ ] **Step 2: Bind `langId` in `video-room-page.html`**

Find:
```html
      <app-comments-panel
        [comments]="commentsStore.comments()"
        [captions]="commentsStore.captions()"
        [currentUserId]="roomStore.userId()"
        [refreshing]="facade.refreshingComments()"
```
Change to:
```html
      <app-comments-panel
        [comments]="commentsStore.comments()"
        [captions]="commentsStore.captions()"
        [currentUserId]="roomStore.userId()"
        [langId]="roomStore.langId()"
        [refreshing]="facade.refreshingComments()"
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.
Run: `npx ng build --configuration development 2>&1 | grep -iE "error" | grep -v "ht-im-connection\|im-socket\|ImSocketService\|imSocket"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/room/pages/room-page/room-page.html src/app/features/room/pages/video-room-page/video-room-page.html
git commit -m "feat(room): pass room langId into the comments panel"
```

---

### Task 7: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm start` (or reuse an already-running instance on port 4200).

- [ ] **Step 2: Walk through the scenarios from the spec's testing plan**

Using the browser (or the `/run` skill if available), for both a voice room and a video/live room:
- Join a room whose `channelInfo.langId` is `1` (or any value not in `{8, 8001, 13, 13001}`) → 3 English chips render above the input: "Hey everyone! 👋", "What's the topic?", "Good vibes only ✨".
- Join a room with `langId` `13` (or `13001`) → 3 Arabic chips render: "مرحبًا بالجميع! 👋", "ما هو الموضوع؟", "تحياتي 🌹".
- Join a room with `langId` `8` (or `8001`) → 3 French chips render: "Salut tout le monde ! 👋", "C'est quoi le sujet ?", "Bonne humeur garantie ! 😄".
- Tap a chip → the phrase appears once in the comment list (not duplicated), and the chip row disappears immediately.
- In a fresh room, type and send a message manually without tapping any chip → the chip row disappears too.
- At a mobile viewport (390×844): the chip row scrolls horizontally if the 3 chips don't fit; it doesn't overlap the comment-input bar below it.
- Leave and rejoin a room where the current user already has a prior comment → the chip row never appears.
- Toggle to "invisible" (if that state is reachable in your test room) → chips render visually dimmed and tapping them does nothing, matching `comment-input`'s own disabled state.

- [ ] **Step 3: Confirm no regressions in the rest of the comments panel**

Confirm the Captions tab still works (chips must not render there), and that a normal typed send still works exactly as before.

- [ ] **Step 4: Final full build check**

Run: `npx ng build --configuration development 2>&1 | grep -iE "error" | grep -v "ht-im-connection\|im-socket\|ImSocketService\|imSocket"`
Expected: no output.

(No commit for this task — it's verification only, over the commits already made in Tasks 1–6.)
