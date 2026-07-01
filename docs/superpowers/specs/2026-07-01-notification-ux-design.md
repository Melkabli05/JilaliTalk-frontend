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

## 2. Ownership split (revised — IM socket is the source of truth)

**Correction from the original draft of this spec:** the fix is not cname-based suppression between two competing sources. Per direct confirmation, the IM socket is authoritative for `stage_invite`, `mod_invite`, `mod_accepted`, `mod_removed`, and `mod_unmuted`. The LiveHub/BFF room-socket copies of these five event types are dropped **unconditionally** — `handle-realtime-event.util.ts` no longer has cases for them at all. `ImBootstrapService` becomes their sole handler, always (not gated by which room is currently open), since it's a global, session-wide connection regardless of room context.

`stage_raisehand` is confirmed **not** duplicated — `HtImNotifyMapper` (IM) has no case for it, only `HtNotifyMapper` (LiveHub/BFF) does — so it stays exactly where it is today: handled by `handle-realtime-event.util.ts`, converted from `confirm.ask()` to an actionable toast per §3.

### 2.1 The `busiType` gap

`RoomApi.stageInviteApproval(cname, busiType, inviteType, approvalType)` needs a `busiType`, but the IM socket's `stage_invite` payload carries only `cname` (confirmed in `HtImNotifyMapper.mapNotify` and `im-events.ts`). `ImBootstrapService` is a global service with no per-room context to source it from otherwise.

Resolution: hardcode `busiType = 2` (voice room) for this one call, backed by evidence rather than a guess — every captured `/livehub/stage/invite_approval` request in `websocket_realtime.md` (real mitmproxy traffic) shows `"busi_type": 2`; no video-room stage-invite has been observed. Document this as `STAGE_INVITE_BUSI_TYPE = 2` with a comment citing this evidence.

`approveManager(cname, hostId)` needs no `busiType` — confirmed by its signature and request body (`{ operation_type, cname, host_id }`). The IM socket's `mod_invite` is about the current authenticated user by construction (`HtImNotifyMapper` defaults `user_id` to the session's own ID when absent), so the id it needs is the current user's own `userId`, available via `AuthStore.user()?.userId` (already injectable at root).

### 2.2 The layering violation this uncovers, and its fix

`ImBootstrapService` (root-provided, `core/realtime/`) needs to call `stageInviteApproval`/`approveManager`, which live on `RoomApi` (`features/room/data/room-api.ts`, currently page-scoped — provided only in `room-page.ts`/`video-room-page.ts`). Two separate problems, both must be fixed:

1. **DI-scope problem:** a root-provided service can't `inject()` something that's only provided at a page's component injector — this throws `NullInjectorError` at app bootstrap. Fix: promote `RoomApi` to `providedIn: 'root'`. It's already stateless (only injects the already-root `HttpClient` and `API_BASE_URL`), so this is safe, and it lets `room-page.ts`/`video-room-page.ts` drop their now-redundant `RoomApi` provider entries.
2. **Layering problem:** even root-provided, `RoomApi` still physically lives under `features/room/`. `core/` importing anything from `features/` is the exact upward/sideways edge this codebase's CLAUDE.md forbids (`features → store → core → shared`; "nothing imports a feature except the router"). This codebase already has an established fix for exactly this shape of problem: `core/tokens/notification-reporter.token.ts` (`NOTIFICATION_REPORTER`) and `core/error/` (`ERROR_REPORTER`) — an abstraction owned by `core/`, bound to its real implementation only in `app.config.ts` (the one composition-root file allowed to wire cross-layer). Apply the same pattern here:

```ts
// core/tokens/room-invite-gateway.token.ts
export interface RoomInviteGateway {
  approveStageInvite(cname: string, accepted: boolean): Observable<void>;
  approveModInvite(cname: string, userId: number): Observable<void>;
}
export const ROOM_INVITE_GATEWAY = new InjectionToken<RoomInviteGateway>('ROOM_INVITE_GATEWAY', { factory: () => ({ ... no-op ... }) });
```

`ImBootstrapService` injects `ROOM_INVITE_GATEWAY`, never `RoomApi` directly. `app.config.ts` binds the token via `useFactory: () => { const api = inject(RoomApi); return { approveStageInvite: ..., approveModInvite: ... }; }` — mirroring the exact shape of the existing `NOTIFICATION_REPORTER` binding in that same file.

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

| Event | Today | After | Owner |
|---|---|---|---|
| `stage_invite` | Blocking modal (BFF) **+** toast+notification (IM) | **Actionable toast** | IM socket, unconditionally |
| `mod_invite` | same duplication as above | **Actionable toast** | IM socket, unconditionally |
| `mod_accepted` / `mod_removed` / `mod_unmuted` | Toast **×2** (BFF + IM) | **Toast ×1** | IM socket, unconditionally; BFF path drops these cases entirely |
| `stage_raisehand` (host approving a raised hand) | Blocking modal | **Actionable toast** | BFF/room socket (unaffected — no IM duplicate) |
| `stage_kick`, `stage_device_control` (mute), self-affecting | Toast, self-only — already correct | Unchanged | BFF/room socket |
| `account_status` (ban / logged in elsewhere) | Toast — already correct, critical + global | Unchanged | IM socket |
| `profile_visit`, `follow`, `voice_room_shared`, `live_room_shared`, `gift_message`, `introduction_message` | Toast **+** notification (duplicate content) | **Notification panel only** | IM socket |
| `text_message`, `image_message`, `group_message` | Notification only — already correct | Unchanged | IM socket |

## 5. Files touched

- `core/tokens/room-invite-gateway.token.ts` — **new** `ROOM_INVITE_GATEWAY` abstraction (§2.2)
- `src/app/app.config.ts` — bind `ROOM_INVITE_GATEWAY` to a `RoomApi`-backed factory, mirroring the existing `NOTIFICATION_REPORTER` binding
- `features/room/data/room-api.ts` — `@Injectable()` → `@Injectable({ providedIn: 'root' })`
- `features/room/pages/room-page.ts`, `features/room/pages/video-room-page.ts` — remove now-redundant `RoomApi` from their `providers:` arrays
- `core/realtime/im-bootstrap.service.ts` — becomes the sole handler for `stage_invite`/`mod_invite`/`mod_accepted`/`mod_removed`/`mod_unmuted` (§2, §2.1); drops toast for passive social events (notification-only per §4)
- `core/services/toast.service.ts` — add `ToastAction` interface, `action()` method
- `shared/ui/toast/toast-container.component.ts` — render action button row when present, dark-mode-aware (reuse existing token patterns already in this file)
- `features/room/data/handle-realtime-event.util.ts` — drop the five reassigned event types entirely; convert `stage_raisehand` from `confirm.ask()` to `toast.action()`; `ConfirmService` import/param dropped from this call chain
- `features/room/pages/room-page-base.ts` — drop now-unused `ConfirmService` injection (confirmed via grep: not used anywhere else in the room feature)

One new file (the gateway token, following the exact precedent of `notification-reporter.token.ts`). No new component; no new store.

## 6. Out of scope / deferred

- `ConfirmService` / `ConfirmDialogComponent` are not deleted — they remain generic, reusable infrastructure in `shared/ui/` for any future destructive/severe confirmation need; only the room feature's two call sites (`stage_invite`/`mod_invite` via IM, `stage_raisehand` via BFF) change, and all three land on actionable toasts instead.

## 7. Testing / verification

- `npx tsc --noEmit` clean.
- Manual verification (per `/verify` or `/run` skill) in the browser: trigger a stage invite while in a room and confirm exactly one actionable toast appears (no modal, no duplicate), regardless of which room is open.
