# Notification / Toast / Confirmation UX Refactor

**Date:** 2026-07-01
**Scope:** Room feature + realtime sockets only (`features/room/**`, `core/realtime/**`, `core/services/toast.service.ts`, `shared/ui/toast/**`). Toast usage elsewhere in the app (header, managers-modal, comments-panel direct-action confirmations) is out of scope — those are simple, single-fire, direct-action confirmations, not noise.

## 1. Problem

Two concrete, backend-verified problems, plus one design mismatch:

1. **True duplicate delivery.** HelloTalk's upstream pushes `stage_invite`, `mod_invite`, `mod_accepted`, `mod_removed`, and `mod_unmuted` on *both* the LiveHub socket (relayed to the frontend as `BffRoomSocketService`, room-scoped — only connected while inside a specific room) and the global IM socket (relayed as `ImSocketService`, connected for the whole authenticated session). Confirmed in `jilalibff`:
   - `com.jilali.realtime.HtNotifyMapper` maps notify_type `18`/`48`/`34`/`35`/`40` → `RoomRealtimeEvent.{StageInvite,ModInvite,ModAccepted,ModRemoved,ModUnmuted}`
   - `com.jilali.im.HtImNotifyMapper` maps the *same* notify_type codes → `ImRealtimeEvent.{StageInvite,ModInvite,ModAccepted,ModRemoved,ModUnmuted}`

   Today, `features/room/data/handle-realtime-event.util.ts` (BFF path) and `core/realtime/im-bootstrap.service.ts` (IM path) each independently toast/notify on these events with no awareness of each other. A user actively in a room sees each of these events twice.

2. **Blocking modal for low-stakes decisions.** `stage_invite`, `mod_invite`, and host-side `stage_raisehand` approval currently use `ConfirmService.ask()` — a full CDK `Dialog` modal — which per NN/G guidance should be reserved for severe, must-resolve issues. These are casual, reversible, low-stakes social decisions; a blocking full-screen interruption is heavier than the decision warrants. Research: [NN/G – Indicators, Validations, and Notifications](https://www.nngroup.com/articles/indicators-validations-notifications/) — "Modal dialogs require the user's attention and resolution and should be reserved for severe errors"; inline/toast-with-actions is the correct weight for this class of decision.

3. **Passive social events double-fire toast + notification with identical content.** `profile_visit`, `follow`, `voice_room_shared`, `live_room_shared`, `gift_message`, `introduction_message` all call both `toast.info(...)` and `notifications.notify(...)` with the same message in `im-bootstrap.service.ts`. Industry pattern (see research) is: toast fires for immediate in-session feedback OR the notification center holds it for later review — not both for the same event.

Everything else audited (self-state toasts like "You were muted", error toasts, direct-action success toasts like "You are now visible") is already single-channel and correct; not touched.

## 2. Dedup architecture

`BffRoomSocketService` already privately tracks which room it's connected to (`reconnectCname`). Expose it:

```ts
// core/realtime/bff-room-socket.service.ts
readonly activeCname = signal<string>('');
// set in connect(), cleared in disconnect() — alongside the existing reconnectCname assignment
```

`ImBootstrapService` injects `BffRoomSocketService` (an established core/realtime → core/realtime sibling import — the same pattern `ImBootstrapService` already uses for `ImSocketService`) and applies this rule before handling `stage_invite` / `mod_invite` / `mod_accepted` / `mod_removed` / `mod_unmuted`:

- **Room-scoped events with a `cname`** (`stage_invite`, `mod_invite` — the IM-side payload carries `cname`): if `event.cname === bffWs.activeCname()`, suppress entirely (the BFF-socket path owns it). Otherwise, the user isn't looking at that room's UI right now — surface as a **notification-panel entry only**, never a toast.
- **Room-scoped events without a `cname`** (`mod_accepted`, `mod_removed`, `mod_unmuted` — the IM-side payload has no `cname`, but a user can only be promoted/demoted/unmuted in a room they're actively in): if `bffWs.activeCname()` is non-empty (any room connected), suppress entirely. Otherwise, notification-panel only.

## 3. Actionable toast (replaces blocking modal)

Extend the existing `Toast` model with optional actions instead of introducing a new service/component layer. (A prior attempt at this used a dedicated `InlineActionService` with `output()` called inside a plain `@Injectable()` and a separate `InlineActionResult` round-trip — that indirection was the source of real compile bugs and added a service/model/component for no benefit over inline closures. This design avoids it.)

```ts
// core/services/toast.service.ts
export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
  readonly variant?: 'primary' | 'ghost';
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
  leaving?: boolean;
  actions?: readonly ToastAction[];
}
```

- New `ToastService.action(message, actions, opts?: { type?; duration? })` method, mirroring `show()`. Default `duration` for actionable toasts is 20000ms (vs. the existing 3000ms default for plain toasts) — per accessibility research, short auto-dismiss windows don't give users enough time to read and decide on an action, unlike a passive info toast.
- `ToastContainerComponent` renders a row of action buttons under the message when `toast.actions` is present; clicking one calls `run()` then dismisses immediately (bypassing the remaining duration).
- **Three distinct dismissal paths, only one of which is a decision:**
  - Tapping an explicit action button → runs that action's `run()` (e.g., fires the accept/decline API call).
  - Tapping the ✕ close button → just hides the toast, no API call (equivalent to "ignore for now").
  - Timeout expiry → same as ✕, no API call.
- Callers build actions as plain closures inline at the call site — no new model file, no new service, no result-passing indirection:

```ts
// features/room/data/handle-realtime-event.util.ts
toast.action(`${nickname} wants to join the stage`, [
  { label: 'Approve', variant: 'primary', run: () => { void firstValueFrom(api.raiseHandApproval(cname, busiType, raiserId, 1)); toast.success(`${nickname} approved`); } },
  { label: 'Dismiss', variant: 'ghost', run: () => {} },
]);
```

## 4. Final per-event-type behavior

| Event | Today | After |
|---|---|---|
| `stage_invite` (user currently in that room) | Blocking modal (BFF) **+** toast+notification (IM) | **Actionable toast only** (BFF path); IM copy suppressed |
| `stage_invite` (different/no room) | toast+notification (IM) | **Notification-panel entry only** |
| `mod_invite` | same duplication as above | same fix as above |
| `stage_raisehand` (host approving a raised hand) | Blocking modal | **Actionable toast** |
| `mod_accepted` / `mod_removed` / `mod_unmuted` (in a room) | Toast **×2** (BFF + IM) | **Toast ×1** (BFF path only; IM suppressed) |
| `stage_kick`, `stage_device_control` (mute), self-affecting | Toast, self-only — already correct | Unchanged |
| `account_status` (ban / logged in elsewhere) | Toast — already correct, critical + global | Unchanged |
| `profile_visit`, `follow`, `voice_room_shared`, `live_room_shared`, `gift_message`, `introduction_message` | Toast **+** notification (duplicate content) | **Notification panel only** |
| `text_message`, `image_message`, `group_message` | Notification only — already correct | Unchanged |

## 5. Files touched

- `core/realtime/bff-room-socket.service.ts` — expose `activeCname` signal
- `core/realtime/im-bootstrap.service.ts` — inject `BffRoomSocketService`, add dedup checks per §2, drop toast for passive social events (notification-only per §4)
- `core/services/toast.service.ts` — add `ToastAction` interface, `action()` method
- `shared/ui/toast/toast-container.component.ts` — render action button row when present, dark-mode-aware (reuse existing token patterns already in this file)
- `features/room/data/handle-realtime-event.util.ts` — replace `confirm.ask()` calls with `toast.action()` for `stage_invite`, `mod_invite`, `stage_raisehand`; `ConfirmService` import/param dropped from this call chain
- `features/room/pages/room-page-base.ts` — drop now-unused `ConfirmService` injection (confirmed via grep: not used anywhere else in the room feature)

No new files. No new service. No new component beyond an additional conditional row in the existing toast container template.

## 6. Out of scope / deferred

- Clicking a demoted (notification-panel-only) `stage_invite`/`mod_invite` notification does not navigate to that room. The IM payload for these carries `cname` but not `busiType`, and the room route requires both (`/room/:cname/:busiType` or `/room/video/:cname/:busiType`); guessing `busiType` would be unreliable. Left as a follow-up if needed later, not built now.
- `ConfirmService` / `ConfirmDialogComponent` are not deleted — they remain generic, reusable infrastructure in `shared/ui/` for any future destructive/severe confirmation need; only their one current room-feature call site changes.

## 7. Testing / verification

- `npx tsc --noEmit` clean.
- Manual verification (per `/verify` or `/run` skill) in the browser: trigger a stage invite while in the target room (single actionable toast, no modal, no duplicate) and, if feasible to simulate, while viewing a different route (notification-panel entry only, no toast).
