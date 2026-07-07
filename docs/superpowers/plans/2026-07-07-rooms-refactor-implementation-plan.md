# Rooms Feature Refactor — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve code health and UX across `features/rooms/` and `features/room/` with three phases — quick wins (A), structural deduplication (B), UX polish (C).

**Architecture:** Three-phase approach. Phase A and C touch UI templates and styles only. Phase B introduces a base class for two existing stores, requiring careful migration order to avoid breaking either page.

**Tech Stack:** Angular 22, Signals, rxResource, OnPush, CDK Dialog

---

## Phase A — Quick Wins

### Task 1: Extract `RecommendedRoomCardComponent` for voice-list

**Files:**
- Create: `src/app/features/rooms/ui/recommended-room-card/recommended-room-card.ts`
- Create: `src/app/features/rooms/ui/recommended-room-card/recommended-room-card.html`
- Create: `src/app/features/rooms/ui/recommended-room-card/recommended-room-card.scss`
- Modify: `src/app/features/rooms/pages/voice-list/voice-list.html:31-133` — replace inline `<article class="rec-card">` block with `<app-recommended-room-card [room]="room" (joinRoom)="onRecommendedJoin($event)" />`
- Modify: `src/app/features/rooms/pages/voice-list/voice-list.scss:140-353` — remove `.rec-card`, `.rec-host`, `.rec-host-avatar`, `.rec-host-info`, `.rec-host-name-row`, `.rec-host-name`, `.rec-crown`, `.rec-host-lang`, `.rec-title`, `.rec-topic`, `.rec-meta`, `.rec-category`, `.rec-members`, `.rec-members-preview`, `.rec-avatars`, `.rec-avatar`, `.rec-members-more`, `.rec-trending`, `.rec-actions`
- Modify: `src/app/features/rooms/pages/voice-list/voice-list.ts` — add `onRecommendedJoin(payload)` method: `void this.joinRoom(payload.room, payload.visible)`

**Interfaces:**
- Input: `room: ChannelListItem` (required)
- Output: `joinRoom: output<{ room: ChannelListItem; visible: boolean }>`

**Steps:**

- [ ] **Step 1: Create `recommended-room-card.html`**

The component template replicates the current inline `rec-card` markup from `voice-list.html:33-131`, converting it to use `input.room` and emit `joinRoom`.

```html
<article
  class="rec-card"
  tabindex="0"
  [attr.aria-label]="'Join ' + room().channel.name + ' hosted by ' + room.hostUser.nickname"
  (keydown.enter)="handleJoin(true)"
  (keydown.space)="handleJoin(true)"
>
  <div class="rec-host">
    <app-avatar
      [src]="room.hostUser.headUrl || ''"
      [initials]="room.hostUser.nickname.slice(0, 2)"
      size="md"
      [alt]="'Host ' + room.hostUser.nickname"
      class="rec-host-avatar"
    />
    <div class="rec-host-info">
      <div class="rec-host-name-row">
        <span class="rec-host-name">{{ room.hostUser.nickname }}</span>
        <svg aria-hidden="true" lucideTrendingUp [size]="8" class="rec-crown"></svg>
      </div>
      @if (room.hostUser.nationality) {
        <span class="rec-host-lang">
          <app-country-flag [code]="room.hostUser.nationality" />
        </span>
      }
    </div>
  </div>

  <h3 class="rec-title">{{ room.channel.name }}</h3>

  @let tag = room.categoryTopicTag;
  @if (tag?.topicName) {
    <p class="rec-topic">{{ tag!.topicName }}</p>
  }

  <div class="rec-meta">
    @if (room.channel.langId) {
      <app-language-tag [langId]="room.channel.langId" />
    }
    <span class="rec-category">{{ tag?.categoryName || 'General' }}</span>
    <span class="rec-members">
      <svg aria-hidden="true" lucideEye [size]="10"></svg>
      {{ room.channel.totalUserCount }}
    </span>
  </div>

  @if (room.users?.length) {
    <div class="rec-members-preview">
      <div class="rec-avatars">
        @for (user of room.users!.slice(0, 4); track user.userId; let i = $index) {
          <app-avatar
            [src]="user.headUrl || ''"
            [initials]="user.nickname.slice(0, 2)"
            size="xs"
            class="rec-avatar"
            [style.z-index]="10 - i"
            [alt]="user.nickname"
          />
        }
      </div>
      @if (room.channel.totalUserCount > 4) {
        <span class="rec-members-more">+{{ room.channel.totalUserCount - 4 }}</span>
      }
    </div>
  }

  @if (room.channel.heatValue && room.channel.heatValue > 50) {
    <div class="rec-trending">
      <svg aria-hidden="true" lucideTrendingUp [size]="10"></svg>
      Popular now
    </div>
  }

  <div class="rec-actions">
    <app-button
      variant="primary"
      size="xs"
      (click)="handleJoin(true, $event)"
      aria-label="Join visible"
    >
      <svg aria-hidden="true" lucideEye [size]="10"></svg>
      Visible
    </app-button>
    <app-button
      variant="soft-warm"
      size="xs"
      (click)="handleJoin(false, $event)"
      aria-label="Join invisible"
    >
      <svg aria-hidden="true" lucideEyeOff [size]="10"></svg>
      Invisible
    </app-button>
  </div>
</article>
```

- [ ] **Step 2: Create `recommended-room-card.scss`**

Extract the `.rec-card` CSS and all `.rec-*` descendant rules from `voice-list.scss:140-353` into this file. Do not include `.recommended-rooms`, `.section-header`, `.carousel-nav`, `.carousel-btn`, `.recommended-rooms-scroll` — those stay in `voice-list.scss`.

```scss
.rec-card {
  flex-shrink: 0;
  width: 240px;
  scroll-snap-align: start;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  &:hover {
    border-color: var(--color-primary-300);
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: var(--focus-ring-offset);
  }

  :host-context(.dark) &:hover {
    border-color: var(--color-primary-700);
    box-shadow: 0 12px 32px rgb(0 0 0 / 40%);
  }
}

.rec-host { display: flex; align-items: center; gap: var(--space-2); }
.rec-host-avatar {
  border: 2px solid var(--color-primary-100);
  :host-context(.dark) & { border-color: var(--color-neutral-700); }
}
.rec-host-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.rec-host-name-row { display: flex; align-items: center; gap: 3px; }
.rec-host-name {
  font-size: var(--text-xs); font-weight: var(--font-semibold); color: var(--color-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0;
  :host-context(.dark) & { color: var(--color-neutral-200); }
}
.rec-crown { color: var(--color-gold-400); flex-shrink: 0; }
.rec-host-lang { font-size: var(--text-xs); color: var(--color-text-muted); }
:host-context(.dark) .rec-host-lang { color: var(--color-neutral-400); }
.rec-title {
  font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--color-text);
  margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2;
  line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  :host-context(.dark) & { color: var(--color-neutral-200); }
}
.rec-topic {
  font-size: var(--text-xs); color: var(--color-text-muted); margin: 0; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 1; line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
  :host-context(.dark) & { color: var(--color-neutral-400); }
}
.rec-meta { display: flex; align-items: center; gap: var(--space-2); }
.rec-category {
  padding: 2px var(--space-2); background-color: var(--color-primary-50);
  color: var(--color-primary-600); border-radius: var(--radius-full);
  font-size: var(--text-xs); font-weight: var(--font-medium);
  :host-context(.dark) & { background-color: var(--color-primary-900); color: var(--color-primary-300); }
}
.rec-members { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--color-text-muted); }
:host-context(.dark) .rec-members { color: var(--color-neutral-300); }
.rec-members-preview { display: flex; align-items: center; gap: var(--space-2); }
.rec-avatars { display: flex; }
.rec-avatar {
  margin-left: -2px; border: 2px solid var(--color-card); border-radius: var(--radius-full);
  &:first-child { margin-left: 0; }
  :host-context(.dark) & { border-color: var(--color-neutral-800); }
}
.rec-members-more { font-size: var(--text-xs); color: var(--color-text-muted); margin-left: var(--space-1); }
:host-context(.dark) .rec-members-more { color: var(--color-neutral-400); }
.rec-trending { display: flex; align-items: center; gap: 4px; font-size: var(--text-xs); color: var(--color-accent-500); font-weight: var(--font-medium); }
.rec-actions { display: flex; gap: var(--space-2); margin-top: auto; app-button { flex: 1; } }
```

- [ ] **Step 3: Create `recommended-room-card.ts`**

```typescript
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { ChannelListItem } from '../../data/rooms-model';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { LucideEye, LucideEyeOff, LucideTrendingUp } from '@lucide/angular';

@Component({
  selector: 'app-recommended-room-card',
  imports: [AvatarComponent, ButtonComponent, CountryFlagComponent, LanguageTagComponent, LucideEye, LucideEyeOff, LucideTrendingUp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recommended-room-card.html',
  styleUrl: './recommended-room-card.scss',
})
export class RecommendedRoomCardComponent {
  readonly room = input.required<ChannelListItem>();
  readonly joinRoom = output<{ room: ChannelListItem; visible: boolean }>();

  handleJoin(visible: boolean, event?: Event): void {
    event?.stopPropagation();
    this.joinRoom.emit({ room: this.room(), visible });
  }
}
```

- [ ] **Step 4: Update `voice-list.html`**

In `voice-list.html:31-133`, replace the entire `@for (room of recommendedRooms().slice(0, 6); track room.channel.cname) { <article class="rec-card"> ... </article> }` block with:

```html
@for (room of recommendedRooms().slice(0, 6); track room.channel.cname) {
  <app-recommended-room-card
    [room]="room"
    (joinRoom)="onRecommendedJoin($event)"
  />
}
```

- [ ] **Step 5: Update `voice-list.ts`**

Add the handler:

```typescript
onRecommendedJoin(payload: { room: ChannelListItem; visible: boolean }): void {
  void this.joinRoom(payload.room, payload.visible);
}
```

- [ ] **Step 6: Update `voice-list.scss`**

Remove all `.rec-*` CSS rules listed in the "Files" section above (lines 140–353 of voice-list.scss). The `.recommended-rooms`, `.section-header`, `.flame-icon`, `.section-title`, `.carousel-nav`, `.carousel-btn`, `.recommended-rooms-scroll` rules stay — they style the carousel container, not the card.

- [ ] **Step 7: Run lint**

```bash
cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend
npm run lint -- --quiet
```
Expected: pass

- [ ] **Step 8: Verify build**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors for voice-list

- [ ] **Step 9: Commit**

```bash
git add src/app/features/rooms/ui/recommended-room-card/ src/app/features/rooms/pages/voice-list/
git commit -m "feat(rooms): extract RecommendedRoomCardComponent from voice-list inline markup"
```

---

### Task 2: Extract shared `room-list.scss`

**Files:**
- Create: `src/app/features/rooms/ui/room-list.scss`
- Modify: `src/app/features/rooms/pages/voice-list/voice-list.scss` — replace with `@import '../ui/room-list.scss';` at top, then page-specific rules below
- Modify: `src/app/features/rooms/pages/live-list/live-list.ts:44` — change `styleUrls: ['../voice-list/voice-list.scss']` to `styleUrls: ['../ui/room-list.scss', './live-list.scss']`
- Create: `src/app/features/rooms/pages/live-list/live-list.scss` — currently has no own styles; will be created with `@import '../ui/room-list.scss';` + any live-list-specific overrides

**Interfaces:**
- None — purely a CSS extraction

**Steps:**

- [ ] **Step 1: Create `room-list.scss` with all shared rules**

Extract from `voice-list.scss` everything that is not `.recommended-rooms`, `.section-header`, `.flame-icon`, `.section-title`, `.carousel-nav`, `.carousel-btn`, `.recommended-rooms-scroll`, or any `.rec-*` class.

```scss
/* Shared page shell for voice-list and live-list */
.voice-list-page {
  padding: var(--space-5);
  @media (width <= 640px) { padding: var(--space-4); }
}

.page-header { margin-bottom: var(--space-8); }
.page-title {
  font-size: var(--text-xl); font-weight: var(--font-bold); color: var(--color-text); margin: 0;
  @media (width <= 640px) { font-size: var(--text-lg); }
}
.page-subtitle { font-size: var(--text-xs); color: var(--color-text-muted); margin: var(--space-1) 0 0; }

.filter-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2);
  margin: var(--space-5) 0 var(--space-8);
  @media (width <= 640px) { gap: var(--space-2); margin: var(--space-4) 0 var(--space-5); }
  app-search-bar { @media (width <= 640px) { flex: 1 1 100%; order: -1; } }
}

.view-toggle {
  display: flex; align-items: center; background-color: var(--color-neutral-100);
  border-radius: var(--radius-lg); padding: 2px;
  :host-context(.dark) & { background-color: var(--color-neutral-800); }
}
.view-btn {
  display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  border: none; border-radius: var(--radius-md); background: transparent;
  color: var(--color-text-muted); cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  &:hover { color: var(--color-text-secondary); }
  &.active { background-color: var(--color-card); color: var(--color-primary-600); box-shadow: 0 1px 2px var(--shadow-sm); }
  &:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
  :host-context(.dark) & { color: var(--color-neutral-400); &:hover { color: var(--color-neutral-200); } &.active { background-color: var(--color-neutral-700); color: var(--color-primary-300); } }
}

.refresh-btn {
  display: flex; align-items: center; justify-content: center; padding: var(--space-2) var(--space-3);
  height: 36px; background-color: var(--color-neutral-100); color: var(--color-text-secondary);
  border: none; border-radius: var(--radius-lg); cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  &:hover { color: var(--color-text); background-color: var(--color-neutral-200); }
  &:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
  &:disabled { cursor: not-allowed; opacity: 0.7; }
  :host-context(.dark) & { background-color: var(--color-neutral-800); color: var(--color-neutral-300); &:hover { background-color: var(--color-neutral-700); } }
}

.clear-filters-btn {
  display: flex; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2);
  background-color: var(--color-warm-50); color: var(--color-warm-600);
  border: 1px solid var(--color-warm-100); border-radius: var(--radius-lg);
  font-size: var(--text-xs); font-weight: var(--font-medium); cursor: pointer;
  transition: background-color 0.15s ease;
  &:hover { background-color: var(--color-warm-100); }
  &:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
  :host-context(.dark) & { background-color: var(--color-warm-900); color: var(--color-warm-300); border-color: var(--color-warm-800); &:hover { background-color: var(--color-warm-800); } }
}

.room-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-5);
  &.list-view { grid-template-columns: 1fr; }
  @media (width <= 640px) { grid-template-columns: 1fr; gap: var(--space-3); }
}
.room-item { animation: fade-in-up 0.3s ease forwards; opacity: 0; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: var(--space-24) var(--space-4); text-align: center; min-height: 300px;
}
.empty-icon {
  width: var(--space-16); height: var(--space-16); border-radius: var(--radius-2xl);
  background-color: var(--color-neutral-100); display: flex; align-items: center;
  justify-content: center; margin-bottom: var(--space-5); color: var(--color-text-muted);
  :host-context(.dark) & { background-color: var(--color-neutral-800); }
}
.empty-title { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--color-text); margin: 0 0 var(--space-1); }
:host-context(.dark) .empty-title { color: var(--color-neutral-200); }
.empty-subtitle { font-size: var(--text-xs); color: var(--color-text-muted); max-width: 260px; line-height: var(--leading-relaxed); margin: 0; }
:host-context(.dark) .empty-subtitle { color: var(--color-neutral-400); }
.empty-reset-btn {
  margin-top: var(--space-5); padding: var(--space-2) var(--space-4);
  background-color: var(--color-neutral-100); color: var(--color-text-secondary); border: none;
  border-radius: var(--radius-lg); font-size: var(--text-xs); font-weight: var(--font-medium); cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  &:hover { background-color: var(--color-neutral-200); color: var(--color-text); }
  &:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
  :host-context(.dark) & { background-color: var(--color-neutral-800); color: var(--color-neutral-300); &:hover { background-color: var(--color-neutral-700); } }
}

.scroll-sentinel {
  height: 32px; display: flex; align-items: center; justify-content: center; margin-top: var(--space-6);
  &.loading::after {
    content: ''; display: block; width: var(--space-5); height: var(--space-5);
    border: 2px solid var(--color-neutral-200); border-top-color: var(--color-primary-500);
    border-radius: 50%; animation: spin 0.7s linear infinite;
  }
  :host-context(.dark) &.loading::after { border-color: var(--color-neutral-700); border-top-color: var(--color-primary-400); }
  @media (width <= 640px) { margin-top: var(--space-4); }
}

.end-of-list { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-8); }
.end-of-list-line { flex: 1; height: 1px; background-color: var(--color-neutral-200); }
:host-context(.dark) .end-of-list-line { background-color: var(--color-neutral-700); }
.end-of-list-text { font-size: var(--text-xs); color: var(--color-text-muted); white-space: nowrap; font-weight: var(--font-medium); }

.spinning { animation: spin 1s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .spinning, .room-item { animation: none; transition: none; transform: none; }
}
```

- [ ] **Step 2: Update `voice-list.scss`**

Replace entire file contents with:

```scss
@import '../ui/room-list.scss';

/* Voice-list only: recommended carousel */
.recommended-rooms { margin-bottom: var(--space-10); }
.section-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-4); }
.flame-icon { color: var(--color-warm-500); }
.section-title {
  font-size: var(--text-xs); font-weight: var(--font-semibold); color: var(--color-text-secondary);
  text-transform: uppercase; letter-spacing: var(--letter-spacing-wide); margin: 0;
}
.carousel-nav { display: flex; gap: var(--space-1); margin-left: auto; }
.carousel-btn {
  display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  border: 1px solid var(--color-border); border-radius: var(--radius-md); background-color: var(--color-card);
  color: var(--color-text-secondary); cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  &:hover { border-color: var(--color-primary-200); color: var(--color-primary-600); background-color: var(--color-primary-50); }
  &:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
  :host-context(.dark) & { background-color: var(--color-neutral-800); border-color: var(--color-neutral-700); color: var(--color-neutral-300); &:hover { border-color: var(--color-primary-700); color: var(--color-primary-300); background-color: var(--color-primary-900); } }
}
.recommended-rooms-scroll {
  display: flex; gap: var(--space-4); overflow-x: auto; padding-top: var(--space-2); padding-bottom: var(--space-2);
  scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .recommended-rooms { margin-bottom: var(--space-6); }
}
```

- [ ] **Step 3: Create `live-list.scss`**

Create the file with:

```scss
@import '../ui/room-list.scss';

/* Live-list has no recommended carousel section — uses app-live-room-card directly in the grid */
```

- [ ] **Step 4: Update `live-list.ts:44`**

```typescript
styleUrls: ['./live-list.scss'],
```

- [ ] **Step 5: Run lint**

```bash
npm run lint -- --quiet
```
Expected: pass

- [ ] **Step 6: Commit**

```bash
git add src/app/features/rooms/ui/room-list.scss src/app/features/rooms/pages/voice-list/voice-list.scss
git add src/app/features/rooms/pages/live-list/live-list.scss src/app/features/rooms/pages/live-list/live-list.ts
git commit -m "refactor(rooms): extract shared room-list.scss, fix fragile cross-page style import"
```

---

### Task 3: Remove `PrivateList` stub

**Files:**
- Delete: `src/app/features/rooms/pages/private-list/private-list.ts`
- Delete: `src/app/features/rooms/pages/private-list/private-list.html`
- Delete: `src/app/features/rooms/pages/private-list/private-list.scss`
- Modify: `src/app/features/rooms/rooms.routes.ts` — remove the `private` route entry

**Steps:**

- [ ] **Step 1: Update `rooms.routes.ts`**

```typescript
// Before (remove the private route):
export const roomsRoutes: Routes = [
  { path: 'voice', component: VoiceListComponent, ... },
  { path: 'live', component: LiveList, ... },
  { path: 'private', component: PrivateList, ... },  // ← remove this
  { path: '', redirectTo: 'voice', pathMatch: 'full' },
];
```

- [ ] **Step 2: Delete the three private-list files**

```bash
rm src/app/features/rooms/pages/private-list/private-list.ts
rm src/app/features/rooms/pages/private-list/private-list.html
rm src/app/features/rooms/pages/private-list/private-list.scss
rmdir src/app/features/rooms/pages/private-list
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "(error|Error|warning)" | head -20
```
Expected: no errors referencing PrivateList

- [ ] **Step 4: Commit**

```bash
git rm -r src/app/features/rooms/pages/private-list/
git add src/app/features/rooms/rooms.routes.ts
git commit -m "refactor(rooms): remove PrivateList stub and dead /private route"
```

---

### Task 4: Simplify join buttons on room cards

**Files:**
- Modify: `src/app/features/rooms/ui/room-card/room-card.ts`
- Modify: `src/app/features/rooms/ui/room-card/room-card.html`
- Modify: `src/app/features/rooms/ui/room-card/room-card.scss`
- Modify: `src/app/features/rooms/ui/live-room-card/live-room-card.ts`
- Modify: `src/app/features/rooms/ui/live-room-card/live-room-card.html`
- Modify: `src/app/features/rooms/ui/live-room-card/live-room-card.scss`

**Interfaces:**
- No change to `joinRoom` output signature

**Steps:**

- [ ] **Step 1: Update `room-card.html`**

Replace the two-button `.card-actions` section with a single primary button + a secondary eye-off icon button:

```html
<div class="card-actions">
  <!-- Primary: visible join (most common case) -->
  <app-button
    variant="primary"
    size="sm"
    class="join-visible-btn"
    (click)="handleJoinVisible($event)"
    [attr.aria-label]="'Join ' + room().channel.name"
  >
    <svg aria-hidden="true" lucideEye [size]="11"></svg>
    Join
  </app-button>

  <!-- Secondary: invisible join — small eye-off icon button -->
  <button
    type="button"
    class="invisible-btn"
    aria-label="Join invisible"
    (click)="handleJoinInvisible($event)"
  >
    <svg aria-hidden="true" lucideEyeOff [size]="13]"></svg>
  </button>
</div>
```

- [ ] **Step 2: Update `room-card.scss`**

Add the `.invisible-btn` styles (add before `host-context` dark section) and remove the second app-button's `variant="soft-warm"` styles since it's now a plain button:

```scss
.invisible-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border: 1.5px solid var(--color-border); border-radius: var(--radius-lg);
  background: transparent; color: var(--color-text-muted); cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
  &:hover { border-color: var(--color-primary-200); color: var(--color-primary-600); background-color: var(--color-primary-50); }
  &:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
  :host-context(.dark) & { border-color: var(--color-neutral-600); color: var(--color-neutral-400); background: transparent; &:hover { border-color: var(--color-primary-700); color: var(--color-primary-300); background-color: var(--color-primary-900); } }
}

.join-visible-btn { flex: 1; }
```

Also update `.card-actions` to not use `justify-content: space-between` (since there's now a fixed-size icon button):

```scss
.card-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: auto;
}
```

- [ ] **Step 3: Update `room-card.ts`**

The existing `handleJoinInvisible` already exists and emits correctly. No TS changes needed.

- [ ] **Step 4: Update `live-room-card.html`**

Apply the same pattern to `live-room-card.html` — replace the two `<app-button>` elements with one primary "Join" and one `<button class="invisible-btn">`:

```html
<div class="card-actions">
  <app-button
    variant="primary"
    size="sm"
    class="join-visible-btn"
    (click)="handleJoin($event)"
    [disabled]="room().channel.totalUserCount === 0"
  >
    Join
  </app-button>
  <button
    type="button"
    class="invisible-btn"
    aria-label="Join invisible"
    [disabled]="room().channel.totalUserCount === 0"
    (click)="handleInvisibleJoin($event)"
  >
    <svg aria-hidden="true" lucideEyeOff [size]="13"></svg>
  </button>
</div>
```

Also add the `.join-visible-btn` and `.invisible-btn` CSS classes to `live-room-card.scss` (same CSS as room-card.scss, add before the dark mode block).

- [ ] **Step 5: Run lint**

```bash
npm run lint -- --quiet
```
Expected: pass

- [ ] **Step 6: Commit**

```bash
git add src/app/features/rooms/ui/room-card/ src/app/features/rooms/ui/live-room-card/
git commit -m "refactor(rooms): simplify join buttons — single visible primary + eye-off icon"
```

---

## Phase B — Structural Debt

### Task 5: Create `RoomListStore` base class

**Files:**
- Create: `src/app/features/rooms/state/room-list.store.ts`

**Interfaces:**
- Abstract class — concrete stores (`VoiceRoomsStore`, `LiveRoomsStore`) extend it
- Abstract members: `busiType: number`, `listRooms()`, `searchRooms()`, `recommendRooms()`, `categoryFilterEnabled: boolean`
- Concrete: all shared signals and logic migrated from `rooms-store.ts`

**Steps:**

- [ ] **Step 1: Read current `rooms-store.ts` fully**

Migrate the following from `rooms-store.ts` unchanged (verbatim) into `room-list.store.ts`:
- All imports (Service, inject, signal, computed, linkedSignal, effect, DestroyRef, rxResource)
- `PAGE_SIZE = 20`, `MAX_SEARCH_PAGES = 5`
- `RoomsPageSource` interface
- All private signals: `search` (SearchDebounce), `_offset`
- `roomsPage` rxResource (the `stream` callback will call abstract `listRooms` or `searchRooms`)
- `_rooms` linkedSignal + `rooms` readonly alias
- `currentType`, `selectedCategoryId`, `selectedLanguageId`, `searchQuery` public readonly signals
- Constructor (the SearchDebounce wiring)
- All computed: `isLoading`, `error`, `hasMore`, `isEmpty`, `filteredRooms`
- `recommendedResource` rxResource + `recommendedRooms`, `isLoadingRecommended`, `recommendedError`
- `categories` + `categoriesResource`
- All methods: `setRoomType`, `loadMore`, `selectCategory`, `selectLanguage`, `setSearchQuery`, `refresh`

For the `stream` callback in `roomsPage` rxResource, use `this.listRooms(...)` / `this.searchRooms(...)` calls (abstract methods).

- [ ] **Step 2: Add abstract method signatures**

```typescript
protected abstract listRooms(langId: number, limit: number, offset: number, refresh: number)
  : Observable<ChannelListResponse>;
protected abstract searchRooms(query: string, langId: number, maxPages: number)
  : Observable<ChannelListResponse>;
protected abstract recommendRooms(excludeCname?: string)
  : Observable<ChannelListResponse>;
protected abstract get categoryFilterEnabled(): boolean;
```

- [ ] **Step 3: Add abstract `busiType` property**

```typescript
abstract readonly busiType: number;
```

- [ ] **Step 4: Update `filteredRooms` computed**

For `RoomsStore` (voice), category filter is used. For `LiveRoomsStore`, it's always `null`. Use `this.categoryFilterEnabled` to decide whether to pass `this.prefs.categoryId()` or `null`.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/rooms/state/room-list.store.ts
git commit -m "feat(rooms): create RoomListStore base class with shared logic"
```

---

### Task 6: Refactor `RoomsStore` → `VoiceRoomsStore`

**Files:**
- Create: `src/app/features/rooms/state/voice-rooms.store.ts`
- Modify: `src/app/features/rooms/pages/voice-list/voice-list.ts:11` — update import

**Interfaces:**
- Same public API as old `RoomsStore` — no change to callers

**Steps:**

- [ ] **Step 1: Create `voice-rooms.store.ts`**

```typescript
import { Service } from '@angular/core';
import { Observable } from 'rxjs';
import { RoomListStore } from './room-list.store';
import { ChannelListResponse, RoomType } from '../data/rooms-model';

@Service({ autoProvided: false })
export class VoiceRoomsStore extends RoomListStore {
  readonly busiType = 2;

  protected listRooms(langId: number, limit: number, offset: number, refresh: number)
      : Observable<ChannelListResponse> {
    return this.api.listRooms(langId, limit, offset, refresh);
  }

  protected searchRooms(query: string, langId: number, maxPages: number)
      : Observable<ChannelListResponse> {
    return this.api.searchRooms(query, langId, RoomType.Voice, maxPages);
  }

  protected recommendRooms(excludeCname?: string)
      : Observable<ChannelListResponse> {
    return this.api.recommendVoiceRooms(excludeCname);
  }

  protected get categoryFilterEnabled(): boolean {
    return true;
  }
}
```

- [ ] **Step 2: Update `voice-list.ts:11`**

```typescript
import { VoiceRoomsStore } from '../../state/voice-rooms.store';
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run build 2>&1 | grep -E "voice-rooms|voice-list" | grep -i error
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/features/rooms/state/voice-rooms.store.ts src/app/features/rooms/pages/voice-list/voice-list.ts
git commit -m "refactor(rooms): extract VoiceRoomsStore from RoomsStore"
```

---

### Task 7: Refactor `LiveRoomsStore` (rename in place)

**Files:**
- Rename: `src/app/features/rooms/state/live-rooms-store.ts` → `src/app/features/rooms/state/live-rooms.store.ts`
- Modify: `src/app/features/rooms/state/room-list.store.ts` — add live rooms specific overrides
- Modify: `src/app/features/rooms/pages/live-list/live-list.ts:9` — update import

**Steps:**

- [ ] **Step 1: Read current `live-rooms-store.ts`**

Note all differences from `rooms-store.ts`:
- No `setRoomType`, no `categories` or `categoriesResource`
- `LivePageSource` (no `type` field)
- `roomsPage` stream calls `listLiveRooms` / `searchRooms(RoomType.Live, ...)`
- `filteredRooms` always passes `null` for category (never `this.prefs.categoryId()`)
- `recommendedResource` calls `recommendLiveRooms('moment_tab')`
- No `selectedCategoryId` signal

- [ ] **Step 2: Extend `RoomListStore` in `live-rooms.store.ts`**

```typescript
import { Service, inject, signal, computed, linkedSignal, effect, DestroyRef } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RoomListStore } from './room-list.store';
import { ChannelListItem, ChannelListResponse, RoomType } from '../data/rooms-model';
import { filterRooms } from '../data/room-filter.util';
import { SearchDebounce, paginateDedup } from '../data/pagination-search.util';
import { RoomsApi } from '../data/rooms-api';
import { RoomsPreferencesStore } from '@store/rooms-preferences.store';
import { Observable } from 'rxjs';

const PAGE_SIZE = 20;
const MAX_SEARCH_PAGES = 5;

@Service({ autoProvided: false })
export class LiveRoomsStore extends RoomListStore {
  readonly busiType = 1;

  protected listRooms(langId: number, limit: number, offset: number, refresh: number)
      : Observable<ChannelListResponse> {
    return this.api.listLiveRooms(langId, limit, offset, refresh);
  }

  protected searchRooms(query: string, langId: number, maxPages: number)
      : Observable<ChannelListResponse> {
    return this.api.searchRooms(query, langId, RoomType.Live, maxPages);
  }

  protected recommendRooms(excludeCname?: string)
      : Observable<ChannelListResponse> {
    return this.api.recommendLiveRooms('moment_tab');
  }

  protected get categoryFilterEnabled(): boolean {
    return false;
  }

  // All other shared logic (roomsPage, _rooms, filteredRooms, loadMore, refresh,
  // selectLanguage, setSearchQuery, isLoading, hasMore, isEmpty, recommendedRooms, etc.)
  // is inherited from RoomListStore — copy verbatim from live-rooms-store.ts here
  // (the body of filteredRooms passes null for categoryId, overriding the base
  // RoomListStore's version which uses this.prefs.categoryId())

  readonly filteredRooms = computed(() =>
    filterRooms(this.rooms(), null, this.prefs.languageId(), this.prefs.searchQuery()),
  );
}
```

- [ ] **Step 3: Rename file**

```bash
mv src/app/features/rooms/state/live-rooms-store.ts src/app/features/rooms/state/live-rooms.store.ts
```

- [ ] **Step 4: Update `live-list.ts:9`**

```typescript
import { LiveRoomsStore } from '../../state/live-rooms.store';
```

- [ ] **Step 5: Verify**

```bash
npm run build 2>&1 | grep -E "live-rooms|live-list" | grep -i error
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/features/rooms/state/live-rooms.store.ts
git add src/app/features/rooms/pages/live-list/live-list.ts
git commit -m "refactor(rooms): extract LiveRoomsStore from RoomListStore base"
```

---

### Task 8: Delete old stores

**Files:**
- Delete: `src/app/features/rooms/state/rooms-store.ts`
- Delete: `src/app/features/rooms/state/live-rooms-store.ts` (already renamed in Task 7)

**Steps:**

- [ ] **Step 1: Verify no remaining imports to old files**

```bash
grep -r "rooms-store\|live-rooms-store" src/ --include="*.ts" | grep -v ".spec.ts" | grep -v "node_modules"
```
Expected: only spec files, no production code

- [ ] **Step 2: Delete**

```bash
rm src/app/features/rooms/state/rooms-store.ts
# (live-rooms-store.ts was already renamed in Task 7)
```

- [ ] **Step 3: Full lint + build**

```bash
npm run lint -- --quiet && npm run build 2>&1 | tail -5
```
Expected: lint pass, build success

- [ ] **Step 4: Commit**

```bash
git rm src/app/features/rooms/state/rooms-store.ts
git commit -m "refactor(rooms): delete old RoomsStore, live-rooms-store (replaced by RoomListStore hierarchy)"
```

---

## Phase C — UX Polish

### Task 9: Add `RecommendedRoomCardComponent` join simplification (A4 follow-through)

**Files:**
- Modify: `src/app/features/rooms/ui/recommended-room-card/recommended-room-card.html`
- Modify: `src/app/features/rooms/ui/recommended-room-card/recommended-room-card.scss`

**Steps:**

- [ ] Apply the same join button simplification (single "Join" primary + eye-off secondary) to the `RecommendedRoomCardComponent` just created in Task 1.

- [ ] Run lint, commit:

```bash
npm run lint -- --quiet
git add src/app/features/rooms/ui/recommended-room-card/
git commit -m "feat(rooms): simplify RecommendedRoomCard join buttons"
```

---

### Task 10: Active-now visual hierarchy (live badge + pulsing dot)

**Files:**
- Modify: `src/app/features/rooms/ui/room-card/room-card.ts`
- Modify: `src/app/features/rooms/ui/room-card/room-card.html`
- Modify: `src/app/features/rooms/ui/room-card/room-card.scss`

**Interfaces:**
- Adds `isActive = computed(() => this.room().channel.totalUserCount > 5)` signal
- No output API change

**Steps:**

- [ ] **Step 1: Add `isActive` computed to `RoomCardComponent`**

```typescript
readonly isActive = computed(() => (this.room().channel.totalUserCount ?? 0) > 5);
```

- [ ] **Step 2: Update `room-card.html`**

In the `.card-members` section (before the member count span), add a pulsing live indicator when active:

```html
<div class="card-members">
  @if (isActive()) {
    <span class="live-dot" aria-label="Live now"></span>
  }
  <div class="member-avatars">
    ...
  </div>
  <span class="members-count">
    <svg aria-hidden="true" lucideUsers [size]="10"></svg>
    {{ room().channel.totalUserCount }}
  </span>
</div>
```

- [ ] **Step 3: Add CSS for `.live-dot` to `room-card.scss`**

```scss
.live-dot {
  width: 7px; height: 7px; border-radius: 50%; background-color: #22c55e;
  animation: pulse-dot 2s ease-in-out infinite; flex-shrink: 0;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.85); }
}
```

- [ ] **Step 4: Add dark mode for `.live-dot`**

```scss
:host-context(.dark) .live-dot { background-color: #16a34a; }
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/rooms/ui/room-card/
git commit -m "feat(rooms): add live-now pulsing dot indicator to room cards"
```

---

### Task 11: `RoomsPreferencesStore` — add hints signals

**Files:**
- Modify: `src/app/store/rooms-preferences.store.ts`

**Steps:**

- [ ] **Step 1: Add new signals**

```typescript
readonly seenInvisibleTooltip = signal(false);
readonly hasSeenInvisibleBanner = signal(false);
readonly hasSeenRaiseHandHint = signal(false);
```

Add a method to mark them seen:

```typescript
markInvisibleTooltipSeen(): void { this.seenInvisibleTooltip.set(true); }
markInvisibleBannerSeen(): void { this.hasSeenInvisibleBanner.set(true); }
markRaiseHandHintSeen(): void { this.hasSeenRaiseHandHint.set(true); }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/store/rooms-preferences.store.ts
git commit -m "feat(rooms): add hint-tracking signals to RoomsPreferencesStore"
```

---

### Task 12: Card invisible-join tooltip (Phase C — C2 part 1)

**Files:**
- Modify: `src/app/features/rooms/ui/room-card/room-card.ts`
- Modify: `src/app/features/rooms/ui/room-card/room-card.html`
- Modify: `src/app/features/rooms/ui/room-card/room-card.scss`

**Steps:**

- [ ] **Step 1: Add `RoomsPreferencesStore` import and injection**

```typescript
private readonly prefs = inject(RoomsPreferencesStore);
```

- [ ] **Step 2: Add `showInvisibleTooltip` computed**

```typescript
readonly showInvisibleTooltip = computed(() =>
  !this.prefs.seenInvisibleTooltip() && !this.room().channel.totalUserCount === 0,
);
```

On click of the invisible button, call `this.prefs.markInvisibleTooltipSeen()`.

- [ ] **Step 3: Update `room-card.html`**

Add tooltip text next to the eye-off button, visible when `showInvisibleTooltip()`:

```html
<div class="invisible-btn-wrap">
  <button
    type="button"
    class="invisible-btn"
    aria-label="Join invisible"
    (click)="handleJoinInvisible($event)"
  >
    <svg aria-hidden="true" lucideEyeOff [size]="13"></svg>
  </button>
  @if (showInvisibleTooltip()) {
    <span class="invisible-hint">Hidden listen</span>
  }
</div>
```

- [ ] **Step 4: Add CSS**

```scss
.invisible-btn-wrap { position: relative; display: flex; align-items: center; }
.invisible-hint {
  position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%);
  white-space: nowrap; background: var(--color-neutral-800); color: var(--color-neutral-100);
  font-size: 10px; padding: 2px 6px; border-radius: var(--radius-sm);
  pointer-events: none; z-index: 10;
  :host-context(.dark) & { background: var(--color-neutral-700); color: var(--color-neutral-100); }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/rooms/ui/room-card/
git commit -m "feat(rooms): add invisible-join tooltip on room cards"
```

---

### Task 13: Room-page invisible banner (Phase C — C2 part 2)

**Files:**
- Modify: `src/app/features/room/pages/room-page/room-page.ts`
- Modify: `src/app/features/room/pages/room-page/room-page.html`
- Modify: `src/app/features/room/pages/room-page/room-page.scss`

**Steps:**

- [ ] **Step 1: Add `RoomsPreferencesStore` import and inject in `room-page.ts`**

```typescript
private readonly roomsPrefs = inject(RoomsPreferencesStore);
```

- [ ] **Step 2: Add banner signal and timeout**

```typescript
readonly showInvisibleBanner = computed(() =>
  !this.roomsPrefs.hasSeenInvisibleBanner() && !this.roomStore.isVisible(),
);
```

On `onLeave()`, call `this.roomsPrefs.markInvisibleBannerSeen()`.

- [ ] **Step 3: Update `room-page.html`**

Add the banner above the room layout:

```html
@if (showInvisibleBanner()) {
  <div class="invisible-banner" role="status">
    <svg aria-hidden="true" lucideEyeOff [size]="13"></svg>
    You're listening invisibly.
    <button type="button" class="banner-dismiss" (click)="roomsPrefs.markInvisibleBannerSeen()">OK</button>
  </div>
}
```

- [ ] **Step 4: Add CSS**

```scss
.invisible-banner {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-neutral-800); color: var(--color-neutral-100);
  font-size: var(--text-xs); border-bottom: 1px solid var(--color-neutral-700);
}
.banner-dismiss {
  margin-left: auto; background: none; border: none; color: var(--color-primary-400);
  cursor: pointer; font-size: var(--text-xs); font-weight: var(--font-medium);
  &:hover { color: var(--color-primary-300); }
}
:host-context(.dark) .invisible-banner { background: var(--color-neutral-900); border-color: var(--color-neutral-700); }
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/room/pages/room-page/
git commit -m "feat(room): add first-time invisible mode banner on room entry"
```

---

### Task 14: Raise-hand hint for first-timers (Phase C — C3)

**Files:**
- Modify: `src/app/features/room/ui/room-header/room-header.ts`
- Modify: `src/app/features/room/ui/room-header/room-header.html`

**Steps:**

- [ ] **Step 1: Inject `RoomsPreferencesStore` in `room-header.ts`**

```typescript
private readonly roomsPrefs = inject(RoomsPreferencesStore);
```

- [ ] **Step 2: Add `showHandLabel` computed**

```typescript
readonly showHandLabel = computed(() => !this.roomsPrefs.hasSeenRaiseHandHint());
```

- [ ] **Step 3: In `room-header.html`**, find the hand-raising button and conditionally show the label:

```html
<button type="button" class="header-btn" [class.active]="isHandRaised()" (click)="toggleHand.emit()">
  <svg aria-hidden="true" lucideHand [size]="16"></svg>
  @if (showHandLabel()) {
    <span>Raise Hand</span>
  }
</button>
```

Also emit `roomsPrefs.markRaiseHandHintSeen()` when the button is clicked (the first time).

- [ ] **Step 4: Add label styling to `room-header.scss`** (if not already present):

```scss
.header-btn span { font-size: var(--text-xs); font-weight: var(--font-medium); }
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/room/ui/room-header/
git commit -m "feat(room): show raise-hand text label on first visit"
```

---

## Verification After All Tasks

```bash
npm run lint -- --quiet && npm run build 2>&1 | tail -10
```

Expected: lint pass, build success with no errors.

Manual smoke test checklist:
- [ ] Voice list loads with recommended carousel using `RecommendedRoomCardComponent`
- [ ] Live list loads with its own stylesheet (not referencing voice-list.scss)
- [ ] `/rooms/private` returns 404
- [ ] Room cards show single Join button + eye-off icon
- [ ] Both voice and live room lists work from new store hierarchy
- [ ] Room cards show live-now pulsing dot when >5 users
- [ ] First invisible join shows banner in room page
- [ ] Raise hand button shows text on first visit
