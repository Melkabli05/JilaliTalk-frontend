# Rooms Feature Refactor — Design Spec

**Date:** 2026-07-07
**Status:** Draft
**Scope:** `features/rooms/` (discovery/list) + `features/room/` (in-room experience)

---

## Context

The rooms feature was built incrementally. Several structural shortcuts accumulated:

- `RoomsStore` and `LiveRoomsStore` are 90% identical clones
- Voice-list's recommended carousel re-implements `RoomCardComponent`'s layout inline
- `LiveList` shares `voice-list.scss` via `styleUrls`, creating silent cross-page coupling
- `PrivateList` is a dead stub route
- The join flow presents two buttons (Visible / Invisible) causing decision fatigue
- Rooms are sorted by heat/recommendation with no visual hierarchy for "active right now"
- Invisible mode has no first-time explainer

This spec addresses all of the above across three phases, ordered by risk.

---

## Phase A — Quick Wins (Low Risk, High Clarity)

### A1. Extract `RecommendedRoomCardComponent`

**Problem:** `voice-list.html` inlines a full `<article class="rec-card">` for the recommended carousel, duplicating the card layout already in `RoomCardComponent`. Live-list correctly uses `LiveRoomCardComponent`.

**Solution:** Create `features/rooms/ui/recommended-room-card/recommended-room-card.ts` (dumb, inputs: `ChannelListItem`, output: `joinRoom`). Extract the inline carousel markup in `voice-list.html` to use this component.

```
src/app/features/rooms/ui/recommended-room-card/
├── recommended-room-card.ts
├── recommended-room-card.html
└── recommended-room-card.scss
```

**Inputs:**
```typescript
interface RecommendedRoomCardComponent {
  readonly room: input.required<ChannelListItem>();
  readonly joinRoom: output<{ room: ChannelListItem; visible: boolean }>();
}
```

The carousel container (prev/next buttons, scroll behavior) stays in `voice-list.html`; only the card itself is extracted. The `rec-card` CSS — which is currently inline in `voice-list.scss` — moves into `recommended-room-card.scss`.

---

### A2. Extract Shared Styles

**Problem:** `LiveList` uses `styleUrls: ['../voice-list/voice-list.scss']` — referencing voice-list's stylesheet directly. Rename or restructure voice-list's styles and live-list silently breaks.

**Solution:** Create `features/rooms/ui/room-list.scss` containing only the genuinely shared layout rules (grid, skeleton, filter bar, empty state, infinite scroll sentinel). Both pages import from this neutral path. Page-specific rules (rec carousel, live badge) stay in each page's own `.scss`.

**Shared rules:** room grid layout, skeleton loader dimensions, filter bar arrangement, empty state, infinite-scroll sentinel, end-of-list divider, view-toggle button, refresh button.

**Page-specific rules (stay in each page's own `.scss`):** recommended carousel (voice only), "LIVE" status overlay (live only), thumbnail aspect ratio (live only).

---

### A3. Remove `PrivateList` Stub

**Problem:** `PrivateList` is a "coming soon" placeholder. The `/rooms/private` route exists but does nothing. Users who navigate there see a bare page.

**Solution:** Remove `PrivateListComponent`, its template, its styles, and its route entry from `rooms.routes.ts`. The route is removed entirely — private rooms can be re-added when implemented.

```typescript
// rooms.routes.ts — remove entirely:
{ path: 'private', component: PrivateListComponent, title: 'Private Rooms', ... }
```

Files to delete:
```
features/rooms/pages/private-list/private-list.ts
features/rooms/pages/private-list/private-list.html
features/rooms/pages/private-list/private-list.scss
```

---

### A4. Simplify Join Buttons on Room Cards

**Problem:** Every room card renders two join buttons ("Join" and "Join Invisible"). For new users this creates decision fatigue. Most apps default visible and hide invisible behind a secondary gesture.

**Solution:**
- Primary button: "Join" — visible entry (the common case)
- Secondary affordance: a small eye-off icon button next to it — triggers invisible join
- Long-press (300ms) on the primary button also triggers invisible join on mobile

**Files to change:**
- `features/rooms/ui/room-card/room-card.ts` + `.html` + `.scss`
- `features/rooms/ui/live-room-card/live-room-card.ts` + `.html` + `.scss`

**Behavior:**
| Interaction | Result |
|---|---|
| Tap "Join" | `joinRoom: { room, visible: true }` |
| Tap eye-off icon | `joinRoom: { room, visible: false }` |
| Long-press "Join" (mobile) | `joinRoom: { room, visible: false }` |

---

## Phase B — Structural Debt (Medium Risk)

### B1. Deduplicate `RoomsStore` + `LiveRoomsStore` into `RoomListStore`

**Problem:** Two nearly identical stores with ~10 shared signals, identical pagination/search/recommendation logic, and only minor differences in which API method is called.

**Actual differences (verified from source):**

| Aspect | `RoomsStore` | `LiveRoomsStore` |
|---|---|---|
| `busiType` | `2` (voice) | `1` (live) |
| API: room list | `listRooms(langId, limit, offset, refresh)` | `listLiveRooms(...)` |
| API: search | `searchRooms(RoomType.Voice, ...)` | `searchRooms(RoomType.Live, ...)` |
| API: recommendation | `recommendVoiceRooms` | `recommendLiveRooms` |
| Category filter | Yes (`categoryId` signal + `selectedCategoryId`) | No |
| `roomType` signal | `RoomType.Voice` | `RoomType.Live` |

**All shared (exact copies):** SearchDebounce, paginateDedup, filteredRooms, recommendedResource, recommendedItems computed, loadMore, refresh, selectLanguage, setSearchQuery, setCategoryId, hasMore, isEmpty, isLoading, error, skeleton resource.

**Solution:** Create a `RoomListStore` base class. Both concrete stores use the same `ChannelListItem` type, so no generic param is needed.

```typescript
// features/rooms/state/room-list.store.ts
@Service({ autoProvided: false })
export abstract class RoomListStore {
  /** 2 = voice, 1 = live. Used for API dispatch. */
  abstract readonly busiType: number;

  // All shared signals and logic (extracted verbatim from RoomsStore):
  protected readonly searchDebounce = signal('');
  protected readonly roomsRef = rxResource<ChannelListItem[]>({ ... });
  protected readonly recommendedRef = rxResource<ChannelListItem[]>({ ... });
  protected readonly paginatedRooms = signal<ChannelListItem[]>([]);
  // ... all identical logic

  // Abstract hooks for the 4 differing pieces:
  protected abstract listRooms(langId: number, limit: number, offset: number, refresh: number)
    : Observable<ChannelListResponse>;
  protected abstract searchRooms(query: string, langId: number, maxPages: number)
    : Observable<ChannelListResponse>;
  protected abstract recommendRooms(excludeCname?: string)
    : Observable<ChannelListResponse>;
  protected abstract get categoryFilterEnabled(): boolean;
}
```

Concrete stores override only the 4 differences:

```typescript
// features/rooms/state/voice-rooms.store.ts
@Service({ autoProvided: false })
export class VoiceRoomsStore extends RoomListStore {
  readonly busiType = 2;
  protected listRooms = (langId, limit, offset, refresh) =>
    this.api.listRooms(langId, limit, offset, refresh);
  protected searchRooms = (query, langId, maxPages) =>
    this.api.searchRooms(query, langId, RoomType.Voice, maxPages);
  protected recommendRooms = (excludeCname) =>
    this.api.recommendVoiceRooms(excludeCname);
  protected readonly categoryFilterEnabled = true;
}

// features/rooms/state/live-rooms.store.ts
@Service({ autoProvided: false })
export class LiveRoomsStore extends RoomListStore {
  readonly busiType = 1;
  protected listRooms = (langId, limit, offset, refresh) =>
    this.api.listLiveRooms(langId, limit, offset, refresh);
  protected searchRooms = (query, langId, maxPages) =>
    this.api.searchRooms(query, langId, RoomType.Live, maxPages);
  protected recommendRooms = (excludeCname) =>
    this.api.recommendLiveRooms(excludeCname);
  protected readonly categoryFilterEnabled = false;
}
```

**Files to create:**
- `features/rooms/state/room-list.store.ts` (base — all shared logic)
- `features/rooms/state/voice-rooms.store.ts` (VoiceRoomsStore, replaces rooms-store.ts)
- `features/rooms/state/live-rooms.store.ts` (LiveRoomsStore, replaces live-rooms-store.ts)

**Files to delete after migration:**
- `features/rooms/state/rooms-store.ts`
- `features/rooms/state/live-rooms-store.ts`

**Migration order:**
1. Read `rooms-store.ts` fully; create `room-list.store.ts` with all shared logic
2. Create `voice-rooms.store.ts` extending `RoomListStore` — overrides only the 4 abstract methods
3. Create `live-rooms.store.ts` extending `RoomListStore` — same pattern
4. Update `VoiceListComponent` providers to use `VoiceRoomsStore` (no other changes needed)
5. Update `LiveListComponent` providers to use `LiveRoomsStore` (no other changes needed)
6. `npm run lint` — verify
7. Manual smoke test — voice list and live list load correctly
8. Delete old store files

---

## Phase C — UX Top to Bottom

### C1. Active-Now Visual Hierarchy

**Problem:** Rooms are sorted by heat/recommendation. A packed room and an empty room look similar until you read the user count. Users can't tell at a glance what's actually live.

**Solution:**

**Card level:** Add a "LIVE" badge + pulsing green dot to cards with `totalUserCount > 5`.

```typescript
// In RoomCardComponent / LiveRoomCardComponent:
readonly isActive = computed(() => (this.room().channel.totalUserCount ?? 0) > 5);
```

**List level:** Add a filter toggle "Active Now" (default: true) to the filter bar. When on, show only rooms where `isActive === true`. When off, show all.

```typescript
// In VoiceRoomsStore / LiveRoomsStore (after Phase B refactor):
readonly showOnlyActive = signal(true);
readonly activeRooms = computed(() =>
  this.showOnlyActive()
    ? this.filteredRooms().filter(r => r.channel.totalUserCount > 5)
    : this.filteredRooms()
);
readonly displayedRooms = computed(() =>
  this.showOnlyActive() ? this.activeRooms() : this.filteredRooms()
);
```

**Files to change:**
- `features/rooms/ui/room-card/room-card.ts` + `.html` + `.scss` — add `[isActive]` input, render live badge
- `features/rooms/ui/live-room-card/live-room-card.ts` + `.html` + `.scss` — same
- `features/rooms/state/voice-rooms.store.ts` — add `showOnlyActive` signal + `activeRooms` computed
- `features/rooms/state/live-rooms.store.ts` — same
- `features/rooms/pages/voice-list/voice-list.ts` — use `displayedRooms` instead of `filteredRooms`
- `features/rooms/pages/live-list/live-list.ts` — same

---

### C2. Invisible Mode First-Time Explainers

**Problem:** "Join Invisible" exists but new users don't know what it means. The option is shown but not explained.

**Solution: Card-level tooltip.** On room cards, the eye-off (invisible join) button gets a tooltip on first use:

- On hover (desktop) or first tap (mobile), show: "Listen without others knowing — you can always switch later."
- Track `seenInvisibleTooltip: boolean` in `RoomsPreferencesStore` — show only once per session.

**Solution: Room-page entry banner.** On first join as invisible, show a one-time banner inside the room page for 5 seconds:

> "You're listening invisibly. Others can't see you here. Tap the eye icon to go visible."

- Banner auto-dismisses after 5s
- Dismiss button to close immediately
- Track `seenInvisibleBanner: boolean` in `RoomsPreferencesStore`

**Files to change:**
- `features/rooms/ui/room-card/room-card.ts` + `.html` — add tooltip to invisible button
- `features/rooms/ui/live-room-card/live-room-card.ts` + `.html` — same
- `features/room/pages/room-page/room-page.ts` — add first-time invisible banner in template
- `features/room/pages/video-room-page/video-room-page.ts` — same
- `store/rooms-preferences.store.ts` — add `seenInvisibleTooltip` and `hasSeenInvisibleBanner` signals

---

### C3. Raise Hand Clarity for First-Timers

**Problem:** "Raise Hand" is how users request to speak. It's not obvious to new users who haven't used a Clubhouse-style app.

**Solution:** The hand-raise button shows a text label "Raise Hand" on first visit (tracked in `RoomsPreferencesStore`), then reverts to icon-only on subsequent visits.

```typescript
// In room-header component:
readonly showHandLabel = computed(() => !this.roomsPrefs.hasSeenRaiseHandHint());
```

On press of the raise hand button: set `roomsPrefs.hasSeenRaiseHandHint.set(true)` so it transitions to icon-only next time.

**Files to change:**
- `features/room/ui/room-header/room-header.ts` — add label based on first-visit state
- `store/rooms-preferences.store.ts` — add `hasSeenRaiseHandHint` signal

---

## Summary of All Changes

| Phase | Change | Files touched | Risk |
|---|---|---|---|
| A1 | Extract RecommendedRoomCardComponent | 3 new files + voice-list.html + voice-list.scss | Low |
| A2 | Extract shared room-list.scss | 1 new file + both page SCSS | Low |
| A3 | Remove PrivateList stub | rooms.routes.ts + 3 deleted files | Low |
| A4 | Simplify join buttons (single primary + eye-off icon) | room-card, live-room-card | Low |
| B1 | Deduplicate stores into RoomListStore base | 3 store files + 2 page components | Medium |
| C1 | Active-now visual hierarchy (live badge + filter) | room-card, both list stores, both list pages | Low |
| C2 | Invisible mode explainers (card tooltip + room banner) | room-card, room pages, preferences store | Low |
| C3 | Raise hand explainer (first-visit label) | room-header, preferences store | Low |

---

## Verification

After each phase:

**Phase A:**
- `npm run lint` passes
- Voice list page loads with recommended carousel using `RecommendedRoomCardComponent`
- Live list page loads with its own stylesheet
- `/rooms/private` returns 404
- Room cards show single Join button + eye-off icon

**Phase B:**
- Voice list and live list load correctly from new store hierarchy
- Language filter, category filter (voice), search, infinite scroll all work on both pages
- `npm run lint` passes

**Phase C:**
- Live badge appears on rooms with >5 users
- "Active Now" filter toggles correctly
- Invisible tooltip shows once per session on join buttons
- First-time invisible banner appears on room entry (then never again)
- Raise hand button shows text on first visit, icon-only after
