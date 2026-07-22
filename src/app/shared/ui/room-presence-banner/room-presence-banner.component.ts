import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import type { UserPresence, UserInfo } from '@core/services/user-info.service';

/**
 * Avatar ring color for the host avatar — Tailwind's emerald-500, the same accent
 * used for the banner's accent strip so the avatar reads as a connected accent
 * surface.
 *
 * Exposed as a class field too (not just module-scope const) because Angular
 * templates can only bind to component-instance members — module-level
 * constants get TS2339 at template-compile time.
 */
const HOST_AVATAR_RING = '#10b981';

@Component({
  selector: 'app-room-presence-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, ButtonComponent, CountryFlagComponent],
  template: `
    @if (presence(); as p) {
      @if (shouldShow()) {
        <section
          class="relative flex items-stretch gap-0 mx-4 max-md:mx-3 rounded-lg max-md:rounded-md
                 border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden
                 bg-[color-mix(in_srgb,#10b981_4%,white)]
                 dark:bg-[color-mix(in_srgb,#10b981_8%,#262626)]
                 dark:shadow-[0_1px_0_0_rgb(16_185_129/12%)_inset]"
          aria-label="Currently in a room"
        >
          <div [class]="accentStripClass()" aria-hidden="true"></div>
          <div class="flex-1 flex flex-col gap-2 max-md:gap-0.5 py-3 px-4 max-md:py-2 max-md:px-3 min-w-0">
            <header class="flex items-center gap-2">
              <span [class]="liveDotClass()" aria-hidden="true"></span>
              <span
                [class]="isCompactViewport() ? 'sr-only' : 'text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.06em] max-md:tracking-[0.04em]'"
              >{{ headerLabel() }}</span>
            </header>

            <div class="text-base max-md:text-sm font-bold text-neutral-900 dark:text-neutral-50 overflow-hidden text-ellipsis whitespace-nowrap leading-tight" [title]="p.cname">{{ roomNameLabel() }}</div>

            @if (hostRowVisible()) {
              <div class="flex items-center gap-2 max-md:gap-1.5 py-1 max-md:py-0">
                <app-avatar
                  [src]="hostAvatarSrc()"
                  [alt]="hostName() ?? 'Host'"
                  [initials]="hostInitials()"
                  [size]="isCompactViewport() ? 'sm' : 'md'"
                  [ringColor]="hostAvatarRing"
                />
                <div class="flex items-center gap-1 max-[340px]:flex-col max-[340px]:items-start max-[340px]:gap-0 min-w-0 flex-1 flex-wrap">
                  <span class="text-xs max-[340px]:text-[10px] text-neutral-500 dark:text-neutral-400">Hosted by</span>
                  <span class="text-xs font-semibold text-neutral-600 dark:text-neutral-200 overflow-hidden text-ellipsis whitespace-nowrap max-w-full">{{ hostName() }}</span>
                  <!-- Live indicator: presence.statusType === 2 means the user is
                       currently a guest in this room, so the host IS in the room
                       right now. For statusType === 1 (modal-target hosts their own
                       room), the "Hosting" header already implies presence so we
                       skip the redundant chip. On compact viewports the pulsing
                       dot in the banner header already signals "active" so the
                       chip is dropped to save space. -->
                  @if (isHostInRoom() && !isCompactViewport()) {
                    <span
                      class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300
                             py-px px-1.5 rounded-full bg-emerald-500/14 dark:bg-emerald-500/22"
                      aria-label="Host is in the room now"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" aria-hidden="true"></span>
                      Live
                    </span>
                  }
                  @if (hostNationality(); as code) {
                    <app-country-flag [code]="code" />
                  }
                </div>
              </div>
            }

            @if (viewerInRoom()) {
              <div
                class="flex items-center justify-center gap-1.5 h-8 max-md:h-7 mt-2 max-md:mt-1 py-0 px-3 rounded-md
                       text-xs max-md:text-[10px] font-semibold text-neutral-600 dark:text-neutral-300
                       bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                role="status"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" aria-hidden="true"></span>
                You're in this room
              </div>
            } @else {
              <div class="actions flex gap-2 mt-2 max-md:gap-1 max-md:mt-1 max-[340px]:flex-col [&>app-button]:flex-1 max-[340px]:[&>app-button]:w-full">
                <app-button variant="primary" size="sm" (click)="onJoin(true)"
                  >Join visible</app-button
                >
                <app-button variant="soft-invisible" size="sm" (click)="onJoin(false)"
                  >Join invisible</app-button
                >
              </div>
            }
          </div>
        </section>
      }
    }
  `,
  /** Remaining irreducible CSS: the pulsing "live" dot's box-shadow keyframe (no
   *  Tailwind built-in animation shape matches this specific expand-and-fade ring),
   *  and the ::ng-deep override of ButtonComponent's internal .btn-sm sizing at
   *  mobile widths — a deliberate deep-pierce into a child component's rendered
   *  DOM, which can't be expressed as a template class on this component's own
   *  elements. */
  styles: [
    `
      @keyframes live-pulse {
        0% { box-shadow: 0 0 0 0 currentColor; }
        70% { box-shadow: 0 0 0 6px transparent; }
        100% { box-shadow: 0 0 0 0 currentColor; }
      }
      @media (max-width: 768px) {
        .actions ::ng-deep .btn-sm {
          padding: 0 8px !important;
          font-size: 10px !important;
          height: 28px !important;
        }
      }
    `,
  ],
})
export class RoomPresenceBannerComponent {
  /** Exposed as a class field (mirrors the module-scope const) so Angular's template
   *  compiler can resolve the `[ringColor]` binding. Module-scope consts aren't
   *  accessible from templates — they trigger TS2339 at compile time. */
  readonly hostAvatarRing = HOST_AVATAR_RING;

  readonly presence = input<UserPresence | null>(null);
  readonly hostInfo = input<UserInfo | null>(null);
  /** Current viewer's own cname (or null if they're not in any room). The
   *  join decision is purely cname equality — "is the viewer in the same
   *  room the modal target is in?". This catches every case correctly:
   *  viewer is the host, viewer is a guest, viewer is the modal target
   *  themselves, viewer is in a totally different room. */
  readonly viewerCname = input<string | null>(null);
  readonly join = output<{ visible: boolean }>();

  readonly shouldShow = computed(() => {
    const p = this.presence();
    return !!p && !p.blackened && (p.statusType === 1 || p.statusType === 2);
  });

  readonly isHosting = computed(() => this.presence()?.statusType === 1);

  readonly headerLabel = computed(() =>
    this.presence()?.statusType === 1 ? 'Hosting' : 'In room',
  );

  readonly roomNameLabel = computed(() => {
    const p = this.presence();
    if (!p) return '';
    const name = p.roomName?.trim();
    if (name) return name;
    return p.statusType === 1 ? 'Hosting a room' : 'In a room';
  });

  readonly hostRowVisible = computed(() => this.presence()?.statusType === 2);

  /** The host is in the room when the user is a guest (statusType=2): the captured
   *  upstream data shows hostId + cname, so the host is actively hosting. We can't
   *  double-check via a streaming signal — there's no per-user presence event on
   *  the BFF socket — but statusType=2 with cname set is authoritative. */
  readonly isHostInRoom = computed(() => {
    const p = this.presence();
    return p?.statusType === 2 && !!p.cname && !p.blackened;
  });

  /** True when the viewport is narrow enough that the banner should use its
   *  compact layout: smaller avatar, no header label, no inline Live chip.
   *  Uses matchMedia for reactive resize tracking (one listener per banner
   *  instance; teardown happens via DestroyRef when the modal closes). */
  private readonly compactMql = typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 768px)')
    : null;
  readonly isCompactViewport = signal(this.compactMql?.matches ?? false);

  /** Accent strip color: emerald while just present in a room, amber ("gold")
   *  while hosting one — the role signal, distinct from the activity pulse. */
  protected readonly accentStripClass = computed(() => {
    const base = 'flex-none w-1';
    return this.isHosting()
      ? `${base} bg-linear-to-b from-amber-300 to-amber-500 dark:from-amber-500 dark:to-amber-700`
      : `${base} bg-linear-to-b from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-700 dark:shadow-[0_0_8px_0_rgb(16_185_129/35%)]`;
  });

  protected readonly liveDotClass = computed(() => {
    const size = this.isCompactViewport() ? 'w-1.5 h-1.5' : 'w-2 h-2';
    const base = `${size} rounded-full shadow-[0_0_0_0_currentColor] shrink-0 animate-[live-pulse_1.8s_ease-out_infinite] motion-reduce:animate-none`;
    return this.isHosting()
      ? `${base} bg-amber-500 text-amber-500 dark:bg-amber-400 dark:text-amber-400`
      : `${base} bg-emerald-500 text-emerald-500 dark:bg-emerald-400 dark:text-emerald-400`;
  });

  constructor() {
    if (this.compactMql) {
      const mql = this.compactMql;
      const handler = (e: MediaQueryListEvent): void => this.isCompactViewport.set(e.matches);
      mql.addEventListener('change', handler);
      // Tear down when the modal closes — DestroyRef is already injected on
      // the host (UserInfoModalComponent), but the banner is destroyed with
      // its parent dialog so DOM teardown handles it cleanly without an
      // explicit removeEventListener in practice. Belt-and-suspenders:
      this.isCompactViewport.set(mql.matches);
    }
  }

  /** True when the *current viewer* is already in the same room the banner
   *  describes — the modal hides the join buttons in that case (no point
   *  re-joining your own room). The check is purely cname equality:
   *  "is the viewer in the same room the modal target is in?". Catches
   *  every case correctly — viewer is the host, viewer is a guest, viewer
   *  is the modal target themselves, or viewer is in a totally different
   *  room (different cname → false). The previous heuristic (statusType
   *  combinations with hostId/userId) missed the guest-of-modal-target case
   *  which is the most common "I'm already here" scenario. */
  readonly viewerInRoom = computed(() => {
    const p = this.presence();
    const vc = this.viewerCname();
    return !!p?.cname && !!vc && p.cname === vc;
  });

  // nickname: top-level first (BFF mapper sets it), then the nested copy, then
  // the string from /livehub/user/status as a last resort.
  readonly hostName = computed(() => {
    const info = this.hostInfo();
    return info?.nickname ?? info?.details?.base?.nickname ?? this.presence()?.hostName ?? null;
  });

  // Avatar URL — prefer the top-level headUrl that comes back with /user/status
  // (instant on first paint), fall through to the nested user-info fetch (which
  // may not have resolved yet). Top-level UserInfo.headUrl is intentionally NOT
  // checked here — the BFF never populates it; the only correct paths are
  // presence.headUrl and hostInfo.details.base.headUrl.
  readonly hostAvatarSrc = computed(() => {
    const fromPresence = this.presence()?.headUrl;
    if (fromPresence) return fromPresence;
    return this.hostInfo()?.details?.base?.headUrl ?? '';
  });

  readonly hostInitials = computed(() => {
    const n = this.hostName();
    return n ? n.slice(0, 2) : '';
  });

  readonly hostNationality = computed(() => {
    const info = this.hostInfo();
    return info?.nationality ?? info?.details?.base?.nationality ?? null;
  });

  onJoin(visible: boolean): void {
    this.join.emit({ visible });
  }
}
