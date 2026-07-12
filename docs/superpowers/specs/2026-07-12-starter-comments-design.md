# Room Comments — Localized Starter Suggestions

**Date:** 2026-07-12
**Scope:** `src/app/features/room/comments/comments-panel.ts`, new `starter-comments.ts` + `starter-comments.util.ts` in the same folder, `src/app/features/room/store/room-store.ts`, `src/app/features/room/commands/enter-room.command.ts`, and the two page templates (`room-page.html`, `video-room-page.html`) that pass the new input through. `comments-store.ts` is untouched (see §5).

## 1. Goals

1. On joining a room, show **3 tappable starter-comment chips** just above the comment-input bar, so a new arrival has a one-tap way to say something instead of facing a blank input.
2. Copy is **localized by the room's primary language** (`channelInfo.langId`, already fetched on room entry): Arabic and French get their own 3-phrase set; every other language (including English) falls back to the English set.
3. Tapping a chip **sends immediately** — same behavior as typing the phrase and pressing send, through the exact same code path (including the existing optimistic-insert + dedup logic).
4. Chips are **visible until the user's first comment lands** in the room (whether sent via a chip or typed manually), then gone for the rest of that room visit. Re-entering the room (fresh page load / fresh room-scoped stores) shows them again.
5. Row is **horizontally scrollable on mobile** — a single-line strip of 3 pill chips with `overflow-x: auto`, matching the existing horizontal-scroll pattern already used for `room-header.scss`'s mobile toolbar overflow. On desktop widths all 3 chips fit without scrolling; no separate desktop layout is needed.

## 2. Non-goals

- No i18n framework, no translation of the app's UI chrome — this app is English-UI-only today (confirmed: no `ngx-translate` / `@angular/localize` dependency). Only the *content* of the 3 suggested messages is localized.
- No admin/config UI to edit the phrases — they're a static data file, changed by editing code.
- No support for the bilingual `langs` (plural) list — only the single primary `langId` drives which set is shown.
- No persistence across room visits (e.g. "seen forever" flag) — visibility is entirely derived from whether the current room session already has a comment from this user, which naturally resets because comment/room stores are page-scoped and recreated per room visit.
- Not shown in the "captions" tab of the comments panel (captions are read-only).

## 3. File layout

```
src/app/features/room/
├── store/room-store.ts              CHANGED — new `langId` signal + `setRoomLanguage()` setter,
│                                       mirrors the existing `topic` / `setRoomTopic()` pair.
├── commands/enter-room.command.ts   CHANGED — two call sites (voice + video/live entry) call
│                                       `roomStore.setRoomLanguage(ch?.langId ?? 1)` next to the
│                                       existing `roomStore.setRoomTopic(...)` call.
├── comments/
│   ├── starter-comments.util.ts     NEW — pure function `getStarterComments(langId): readonly string[]`.
│   ├── starter-comments.ts          NEW — dumb presentational component, 3 chips + horizontal scroll.
│   └── comments-panel.ts            CHANGED — new `showStarterComments` computed (derived from the
│                                       already-injected `commentsStore.comments()` and the component's
│                                       existing `currentUserId` input — no store changes needed);
│                                       renders `<app-starter-comments>` above `<app-comment-input>`
│                                       in the "comments" tab panel only.
└── pages/
    ├── room-page/room-page.html         CHANGED — passes `[langId]="roomStore.langId()"` through
    │                                       to `<app-comments-panel>`.
    └── video-room-page/video-room-page.html   CHANGED — same.
```

No changes to `send-comment.command.ts` or `comment-input.ts` — sending from a chip reuses the exact `onSendComment` handler already wired from `comments-panel.ts` to the page components.

## 4. Language → copy mapping (`starter-comments.util.ts`)

```ts
export function getStarterComments(langId: number): readonly string[] {
  if (langId === 13 || langId === 13001) return ARABIC;   // Arabic, AR=EN
  if (langId === 8 || langId === 8001) return FRENCH;      // French, FR=EN
  return ENGLISH; // English (1) and every other langId
}
```

Phrase sets (final, as approved):

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
```

`getStarterComments` is a pure function with no DI, no `this` — lives in `starter-comments.util.ts` per CLAUDE.md §5, trivially unit-testable in isolation (even though per standing instruction we won't add new unit tests this session).

## 5. Store contract

**`room-store.ts` additions** (the only store-level change — `CommentsStore` / `CommentsReader` are untouched):
```ts
private readonly _langId = signal(1); // default English
readonly langId = this._langId.asReadonly();
setRoomLanguage(langId: number): void { this._langId.set(langId); }
```

Visibility of the chip row is computed one level up, in `CommentsPanelComponent` (see §6) — `CommentsStore` already exposes `comments: Signal<readonly Comment[]>` via `CommentsReader`, and `CommentsPanelComponent` already receives `currentUserId` as its own component input (`[currentUserId]="roomStore.userId()"` from the page templates), so no new store surface is needed. (An earlier draft of this spec put the computed inside `CommentsStore` keyed off `EventFeedStore`'s internal `_currentUserId` — caught in self-review: that field is a private plain number, not reactive and not exposed, so the store can't see it. Computing at the component level, where both pieces of data are already available, avoids that problem entirely.)

## 6. Component contract

**`starter-comments.ts`** (new, dumb/presentational, `shared/ui`-style but feature-local since it depends on `langId`/phrase data owned by the room feature — stays in `features/room/comments/` per CLAUDE.md §6):
```ts
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
})
export class StarterCommentsComponent {
  readonly langId = input<number>(1);
  readonly disabled = input(false);
  readonly pick = output<string>();

  protected readonly phrases = computed(() => getStarterComments(this.langId()));
  protected readonly sending = signal(false);

  onPick(phrase: string): void {
    if (this.sending() || this.disabled()) return; // guards double-tap and the invisible-user case
    this.sending.set(true);
    this.pick.emit(phrase);
  }
}
```

Note: `sending` is a local guard against a double-tap firing two sends before the parent's optimistic insert updates `showStarterComments()` and unmounts this component on the next change-detection pass — belt-and-suspenders since the `@if` removal is expected to be effectively immediate, but the disabled state also gives the user visible tap feedback.

**`comments-panel.ts` additions** — a computed alongside the existing `currentUserId` input and injected `commentsStore`:
```ts
protected readonly showStarterComments = computed(() =>
  !this.commentsStore.comments().some((c) => c.userId === this.currentUserId()),
);
```
Template change (inside the existing `comments` tab panel, above `<app-comment-input>`):
```html
@if (showStarterComments()) {
  <app-starter-comments
    [langId]="langId()"
    [disabled]="disabled()"
    (pick)="onSendComment({ text: $event })"
  />
}
<app-comment-input ... />
```
`onSendComment` is the method that already exists on `CommentsPanelComponent` (currently invoked from `app-comment-input`'s `(send)` output) — reused verbatim, so a chip-originated send is indistinguishable from a typed one all the way down through `sendComment.emit(...)` → the page's `onSendComment` → `sendVoiceComment` / `sendVideoComment`.

`CommentsPanelComponent` gains one new input: `readonly langId = input<number>(1);`.

## 7. Styling (mobile-first horizontal scroll)

```scss
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
  color: var(--cp-tab-active-txt, var(--color-primary-600));
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
}
.starter-chip:disabled { opacity: 0.5; cursor: default; }
.starter-chip:active:not(:disabled) { transform: scale(0.96); }
```
Same visual language as `.new-messages-pill` (rounded, bordered, primary-tinted text). At mobile widths the 3 chips' combined width can exceed the viewport, so the row scrolls horizontally; at desktop widths (wider comments-panel sidebar) all 3 fit and the row simply doesn't scroll — one ruleset covers both, no `@container` breakpoint needed here.

## 8. Edge cases & error handling

- **`langId` not yet known** (component renders before `enter-room.command.ts`'s response lands): `RoomStore.langId()` defaults to `1` (English), so chips render with the English set momentarily correct-by-default rather than empty/wrong; once the real `langId` arrives the computed phrase list updates reactively.
- **Room has an unrecognized/legacy `langId`** (e.g. `0`, or any id not in {1, 8, 8001, 13, 13001}): falls back to English, per the explicit fallback rule in `getStarterComments`.
- **User already has a comment in the room** (e.g. rejoining a room where their old comments were preloaded via `updateComments`/history fetch): `showStarterComments` is `false` from the first computation — chips never flash on-screen, since the check runs against `commentsStore.comments()` (already populated by history load) before the `@if` first renders.
- **Rapid double-tap on a chip**: guarded by the component's local `sending` signal, so at most one `pick` emission per component lifetime.
- **User switches tabs (Comments ⇄ Captions) before sending**: `showStarterComments` is unaffected by tab switching (tab state is separate, in `CommentsPanelComponent.activeTab`), so the chip visibility state is preserved correctly when returning to the Comments tab.
- **Disabled state** (`disabled()` input on `CommentsPanelComponent`, e.g. user is invisible): passed straight through to `app-starter-comments`'s own `disabled` input, same as `app-comment-input` already receives it. Chips render visually dimmed (`.starter-chip:disabled { opacity: 0.5 }`) and `onPick` is a no-op while disabled — matching `comment-input`'s existing disabled treatment exactly.
- **Dark mode**: reuses existing tokens (`--color-border`, `--color-card`, `--color-primary-600`), no new dark-mode overrides needed.
- **Accessibility**: chips are real `<button type="button">` elements in a `role="group"` with an `aria-label`, so they're keyboard-focusable and screen-reader-navigable like any other button row; no custom ARIA widget needed since this isn't a listbox/radiogroup (each tap is an independent action, not a selection).

## 9. Testing plan (skip unit tests per user standing instruction)

- `tsc -p tsconfig.app.json --noEmit` clean.
- `ng build` clean (only pre-existing unrelated warnings).
- Manual verification via `/run` or dev server:
  - Join an English-language room → 3 English chips visible above the input.
  - Join an Arabic-language room (`langId` 13) → 3 Arabic chips, rendered RTL-correctly as plain text (no `dir` attribute needed for short inline phrases).
  - Join a French-language room (`langId` 8) → 3 French chips.
  - Join a room with an unmapped `langId` (e.g. Spanish, 7) → falls back to English chips.
  - Tap a chip → comment sends immediately, appears once (not duplicated — this is exercising the same dedup path fixed earlier), chip row disappears.
  - Type and send a message manually without tapping any chip → chip row disappears too.
  - Mobile viewport (390×844): row scrolls horizontally if all 3 don't fit; no layout overlap with the comment-input bar below it.
  - Rejoin a room where the user already has prior comments → chip row never appears.

## 10. Out of scope / deferred

- Additional languages beyond Arabic/French/English-fallback.
- Editable/configurable phrase sets (admin UI).
- Per-room custom starter comments (e.g. host-defined).
- Chip usage analytics/telemetry.
