# Room Header — Mobile-First Redesign

**Date:** 2026-07-02
**Scope:** `features/room/feature/room-header/room-header.ts` only, plus two small necessary touches outside it: `src/index.html` (viewport meta tag, required for safe-area insets to function at all) and removing one dead output binding in `features/room/pages/room-page.ts` (`(goBack)`, see §7).

## 1. Problem

The current header (`room-header.ts`, ~1200 lines, inline template + styles) packs identity (status dot, room name, topic, room ID with copy), every media control (mic, camera, screen share, hand-raise), and every secondary action (gift, pitch, rewards, noise-suppression, managers, captions, invisible toggle, leave) into a single 56px row, funneling anything that doesn't fit under 1024px container width into a bottom-sheet overflow menu. Concrete issues:

1. **Touch targets fall below platform minimums.** `--toolbar-btn-size-sm` (32px) kicks in under 700px container width — below both iOS's 44pt and Material's 48dp minimums. The inline copy-to-clipboard control on the room ID has an effective hit area of roughly 16×12px.
2. **A broken affordance.** The connection-status dot's tooltip reads "Disconnected — tap to refresh" but the dot has no click handler — tapping it does nothing.
3. **Identity block eats a full line for a rarely-actioned control.** Topic + room ID are permanently rendered even though the room ID is only useful when copying it, and topic is rarely load-bearing during an active session.
4. **Dead code.** `goBack` output, the `LucideArrowLeft` import, and `.back-btn` CSS are all unused — no template element renders a back button; `room-page.ts` binds `(goBack)="onLeave()"`, an exact duplicate of `(leave)="onLeave()"`.
5. **Safe-area insets are inert.** `env(safe-area-inset-*)` is already used in four places in the app (including this component's overflow sheet), but `src/index.html`'s viewport meta tag lacks `viewport-fit=cover`, so on iOS every one of those resolves to `0`. The insets have never actually done anything.
6. **No focus management in the overflow sheet.** It opens without moving focus in, and doesn't return focus to the trigger on close.
7. **Animations aren't reduced-motion aware.** The status dot's pulse and the mic's speaking-ring animation ignore `prefers-reduced-motion`, even though `global.scss` already establishes that convention elsewhere.

## 2. Research basis

Mobile headers in voice/room-style apps (Telegram voice chats, Clubhouse-style rooms, Discord's mobile voice UI) and Material 3's top-app-bar guidance converge on the same shape: show only what answers "where am I / am I connected / am I heard / how do I leave" permanently, defer everything else one tap away, and never place an interactive element under 44px (iOS) / 48dp (Material). Given this redesign is scoped to the header only (no new bottom-anchored control bar outside it — see decision below), the header cannot reach the bottom thumb-zone; the applicable levers are: fewer permanent items, full-size targets, and an overflow sheet that itself opens into the thumb zone.

**Explicit scope decision:** stay inside `RoomHeaderComponent`; no new sibling component in `room-page.ts`. This was proposed as the default (matching "focus exclusively on the Room Header component") and approved.

## 3. Information hierarchy

**Always visible, one row, mobile:**
- Connection status dot (quiet when connected, colored + pulsing + tappable-to-refresh when degraded)
- Room name (single line, tap opens the room-info panel — see §4)
- Mic toggle (primary — largest, leftmost of the action cluster)
- Hand-raise / stage action
- "More actions" entry point (existing overflow sheet)
- Leave (danger, top-right)

**Moves to the room-info panel (§4):** topic, room ID + copy, invisible/visible toggle.

**Stays in / moves to the overflow sheet (unchanged mechanism, refined per §6):** camera, screen share, refresh, gift, pitch, rewards, noise-suppression settings, managers, captions. Captions loses its previous "always visible" special-casing — it's one thumb-reach tap away in the sheet, consistent with everything else non-essential.

Desktop/wide-container behavior (≥1024px, unchanged trigger point) keeps today's fuller row — this redesign is about the mobile/narrow path; the wide layout already works and isn't the complaint.

## 4. Room-info panel (new)

Tapping the room name opens a small anchored popover (same visual language/positioning approach as the existing `<app-av-settings>` dropdown — not a new pattern) containing: full room name, topic, room ID with a full 44px copy button, and the invisible/visible toggle (moved out of the row's `.hide-mobile` badge). This is implemented as a new `@if`-gated block within `room-header.ts`, not a new component file — it's small and entirely local to this component's state (`showRoomInfo` signal, sibling to the existing `showSettings`/`showOverflow` signals).

Closes on: outside click, Escape, selecting an action inside it. Reuses the existing focus-return pattern being added for the overflow sheet (§6).

## 5. Connection status

Dot stays visually minimal when `wsStatus() === 'connected'`. For `connecting` / `reconnecting` / `disconnected`, it keeps its existing color coding and pulse, and gains a click handler: `disconnected` triggers `refresh()` (matching the tooltip's existing promise); `connecting`/`reconnecting` are non-interactive (nothing to trigger mid-flight). `aria-live="polite"` wraps the tooltip text source so a status change is announced without polling.

## 6. Touch targets & responsive strategy

- `--toolbar-btn-size` becomes the existing `--touch-target-min` token (44px) at every container width. The `--toolbar-btn-size-sm` (32px) variant and its `@container room-header (max-width: 699.98px)` shrink rule are deleted outright — not replaced — since constant 44px + the row's existing horizontal-scroll (`.header-center { overflow-x: auto }`) already handles narrow widths without shrinking targets.
- Icon size inside toolbar buttons moves from 16px to 18px to stay visually proportional in the larger button.
- Overflow-sheet rows get a `min-height` ensuring ≥44px regardless of content, `role="dialog" aria-modal="true"` on the panel, focus moved to the first row on open (via `afterNextRender` or `viewChild` + `.focus()`), and focus returned to the "more actions" trigger button on close (both Escape and backdrop-click paths).
- Room-info panel gets the same dialog semantics and focus handling, factored into one small private helper shared by both (`trapFocusAndReturnOnClose` or inline equivalent — implementation detail for the plan, not a new public component).

## 7. Cleanup

- Remove `goBack` output, `LucideArrowLeft` import, `.back-btn` CSS rule from `room-header.ts`.
- Remove the now-dangling `(goBack)="onLeave()"` binding from `room-page.ts`.
- No behavior change: `(leave)="onLeave()"` already covers the exact same flow.

## 8. Safe area / notch support

Add `viewport-fit=cover` to the viewport meta tag in `src/index.html`. This is additive and low-risk — it's what makes every existing and new `env(safe-area-inset-*)` usage in the app (not just this component) actually resolve to a non-zero value on notched iOS devices instead of silently being `0`. Without it, nothing else in this spec's safe-area handling has any real effect.

The header itself doesn't need a new top-inset padding rule: per investigation, it visually occupies the same top band as — and sits above (`z-index: var(--z-overlay)`) — the global app shell header, and the room page is a fixed-height, non-scrolling shell. Confirm during implementation whether the header needs its own `padding-top: env(safe-area-inset-top, 0px)` once `viewport-fit=cover` is live (testable in a browser device-toolbar simulation with a notch device preset); add it only if visual verification shows content clipped under the status bar/notch.

## 9. Visual polish

- Replace the flat `border-bottom: 1px solid var(--rh-border)` with a soft shadow for a less flat, more elevated feel (reuse `--shadow-xs` or similar existing token — no new shadow token).
- Keep existing micro-interactions as-is: press-scale (`scale(0.92)`), mic speaking-pulse ring, refresh spin. These already read as polished.
- Wrap the pulse/spin/panel-enter `@keyframes` usages so they respect `prefers-reduced-motion` (matching the existing global convention in `global.scss`) — e.g. gate the animation properties behind `@media (prefers-reduced-motion: no-preference)` or provide a static fallback under `(prefers-reduced-motion: reduce)`.

## 10. What does not change

- All existing inputs/outputs keep their current names and semantics except the removed `goBack`.
- `MicButtonComponent` and `AvSettingsComponent` integration points (inputs/outputs) are unchanged. `MicButtonComponent`'s own `@container mic-button (max-width: 699.98px)` shrink rule is removed for the same reason as `--toolbar-btn-size-sm` in §6 — it would otherwise put the mic button, the single most-used control, below the 44px floor exactly when the header is narrowest.
- Desktop/wide (≥1024px) layout and behavior are unchanged.
- The overflow bottom-sheet's swipe-to-dismiss gesture, backdrop, and section grouping mechanism are kept; only sizing/semantics are refined.
