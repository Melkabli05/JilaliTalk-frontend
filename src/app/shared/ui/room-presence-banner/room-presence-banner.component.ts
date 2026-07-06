import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import type { UserPresence, UserInfo } from '@core/services/user-info.service';

/**
 * Avatar ring color for the host avatar. Same accent token as the banner's accent
 * strip so the avatar reads as a connected accent surface. The token already
 * resolves to its dark-mode variant via the avatar's own `:host-context(.dark)`
 * cascade, so a single literal is enough.
 *
 * Exposed as a class field too (not just module-scope const) because Angular
 * templates can only bind to component-instance members — module-level
 * constants get TS2339 at template-compile time.
 */
const HOST_AVATAR_RING = 'var(--color-accent-500)';

@Component({
  selector: 'app-room-presence-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, ButtonComponent, CountryFlagComponent],
  template: `
    @if (presence(); as p) {
      @if (shouldShow()) {
        <section
          class="presence-banner"
          [class.hosting]="isHosting()"
          aria-label="Currently in a room"
        >
          <div class="accent-strip" aria-hidden="true"></div>
          <div class="banner-body">
            <header class="banner-header">
              <span class="live-dot" aria-hidden="true"></span>
              <span class="header-label">{{ headerLabel() }}</span>
            </header>

            <div class="room-name" [title]="p.cname">{{ roomNameLabel() }}</div>

            @if (hostRowVisible()) {
              <div class="host-row">
                <app-avatar
                  [src]="hostAvatarSrc()"
                  [alt]="hostName() ?? 'Host'"
                  [initials]="hostInitials()"
                  size="md"
                  [ringColor]="hostAvatarRing"
                />
                <div class="host-meta">
                  <span class="host-prefix">Hosted by</span>
                  <span class="host-name">{{ hostName() }}</span>
                  <!-- Live indicator: presence.statusType === 2 means the user is
                       currently a guest in this room, so the host IS in the room
                       right now. For statusType === 1 (modal-target hosts their own
                       room), the "Hosting" header already implies presence so we
                       skip the redundant chip. -->
                  @if (isHostInRoom()) {
                    <span class="host-live" aria-label="Host is in the room now">
                      <span class="host-live-dot" aria-hidden="true"></span>
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
              <div class="in-room-notice" role="status">
                <span class="in-room-dot" aria-hidden="true"></span>
                You're in this room
              </div>
            } @else {
              <div class="actions">
                <app-button variant="primary" size="sm" (click)="onJoin(true)"
                  >Join Visible</app-button
                >
                <app-button variant="soft-invisible" size="sm" (click)="onJoin(false)"
                  >Join Invisible</app-button
                >
              </div>
            }
          </div>
        </section>
      }
    }
  `,
  styles: [
    `
      /* -------- Container -------- */
      .presence-banner {
        position: relative;
        display: flex;
        align-items: stretch;
        gap: 0;
        margin: 0 var(--space-4);
        background: color-mix(in srgb, var(--color-accent-500) 4%, var(--color-card));
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-elevation-1);
        overflow: hidden;
      }
      :host-context(.dark) .presence-banner {
        background: color-mix(in srgb, var(--color-accent-500) 8%, var(--color-neutral-800));
        border-color: var(--color-neutral-700);
        box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-accent-500) 12%, transparent) inset;
      }

      /* -------- Accent strip --------
       Vertical bar on the leading edge — soft gradient that's brighter in dark mode
       (via inner glow). When the user is hosting their own room, swap to gold so
       the visual language signals the role, not just the activity state. */
      .accent-strip {
        flex: 0 0 4px;
        background: linear-gradient(180deg, var(--color-accent-400), var(--color-accent-600));
      }
      :host-context(.dark) .accent-strip {
        background: linear-gradient(180deg, var(--color-accent-500), var(--color-accent-700));
        box-shadow: 0 0 8px 0 color-mix(in srgb, var(--color-accent-500) 35%, transparent);
      }
      .presence-banner.hosting .accent-strip {
        background: linear-gradient(180deg, var(--color-gold-300), var(--color-gold-500));
      }
      :host-context(.dark) .presence-banner.hosting .accent-strip {
        background: linear-gradient(180deg, var(--color-gold-500), var(--color-gold-700));
      }

      /* -------- Inner content (strip is the sibling, not the parent) -------- */
      .banner-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        min-width: 0;
      }

      /* -------- Header row: live dot + label -------- */
      .banner-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      /* Pulsing live dot — universal "currently active" signal. The pulse keyframe
       uses the dot's own background color via currentColor, so a single keyframe
       block works for all role + theme combinations (set per-combo on the dot
       itself). */
      .live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-accent-500);
        color: var(--color-accent-500);
        box-shadow: 0 0 0 0 currentColor;
        animation: live-pulse 1.8s ease-out infinite;
        flex-shrink: 0;
      }
      :host-context(.dark) .live-dot {
        background: var(--color-accent-400);
        color: var(--color-accent-400);
      }
      .presence-banner.hosting .live-dot {
        background: var(--color-gold-500);
        color: var(--color-gold-500);
      }
      :host-context(.dark) .presence-banner.hosting .live-dot {
        background: var(--color-gold-400);
        color: var(--color-gold-400);
      }
      @keyframes live-pulse {
        0% {
          box-shadow: 0 0 0 0 currentColor;
        }
        70% {
          box-shadow: 0 0 0 6px transparent;
        }
        100% {
          box-shadow: 0 0 0 0 currentColor;
        }
      }

      .header-label {
        font-size: var(--text-2xs);
        font-weight: var(--font-bold);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      :host-context(.dark) .header-label {
        color: var(--color-neutral-400);
      }

      /* -------- Room name -------- */
      .room-name {
        font-size: var(--text-base);
        font-weight: var(--font-bold);
        color: var(--color-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.2;
      }
      :host-context(.dark) .room-name {
        color: var(--color-neutral-50);
      }

      /* -------- Host row (statusType=2 only) -------- */
      .host-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) 0;
      }
      .host-meta {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        min-width: 0;
        flex: 1;
        flex-wrap: wrap;
      }
      .host-prefix {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }
      :host-context(.dark) .host-prefix {
        color: var(--color-neutral-400);
      }
      .host-name {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
      }
      :host-context(.dark) .host-name {
        color: var(--color-neutral-200);
      }
      /* Live indicator — answers "is the host in the room right now?". Static
         green dot+label is scannable without competing with the header's
         pulsing dot. Shows for statusType=2 (guest in someone else's room),
         where the host's actual presence is the meaningful question; statusType=1
         self-hosts the room so the banner header itself implies "here now". */
      .host-live {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--text-2xs);
        font-weight: var(--font-semibold);
        color: var(--color-accent-700);
        padding: 1px 6px;
        border-radius: var(--radius-full);
        background: color-mix(in srgb, var(--color-accent-500) 14%, transparent);
      }
      :host-context(.dark) .host-live {
        color: var(--color-accent-300);
        background: color-mix(in srgb, var(--color-accent-500) 22%, transparent);
      }
      .host-live-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-accent-500);
        flex-shrink: 0;
      }
      :host-context(.dark) .host-live-dot { background: var(--color-accent-400); }

      /* -------- Actions -------- */
      .actions {
        display: flex;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }
      .actions app-button {
        flex: 1;
      }

      /* "You're in this room" — shown in place of the join buttons when the
         viewer is already in the same room the banner describes. Muted
         neutral background with a static (non-pulsing) dot to keep the
         "you're here" state visually distinct from the action row. */
      .in-room-notice {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 32px;
        margin-top: var(--space-2);
        padding: 0 var(--space-3);
        border-radius: var(--radius-md);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
        background: var(--color-neutral-100);
        border: 1px solid var(--color-border);
      }
      :host-context(.dark) .in-room-notice {
        color: var(--color-neutral-300);
        background: var(--color-neutral-800);
        border-color: var(--color-neutral-700);
      }
      .in-room-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-accent-500);
        flex-shrink: 0;
      }
      :host-context(.dark) .in-room-dot { background: var(--color-accent-400); }

      /* -------- Responsive --------
       The modal itself is 340px on desktop and ~100vw on phones, so the
       banner can shrink its outer margin + inner padding at narrow widths.
       Below 320px the two side-by-side buttons + host row start to feel
       cramped, so we stack vertically and align the host meta to feel like
       a single labelled row. */
      @media (max-width: 380px) {
        .presence-banner {
          margin: 0 var(--space-3);
          border-radius: var(--radius-md);
        }
        .banner-body {
          padding: var(--space-2) var(--space-3);
          gap: var(--space-1);
        }
        .room-name {
          font-size: var(--text-sm);
        }
        .host-row {
          padding: 0;
        }
        .header-label {
          letter-spacing: 0.04em;
        }
      }
      @media (max-width: 320px) {
        .actions {
          flex-direction: column;
        }
        .actions app-button {
          width: 100%;
        }
        .host-meta {
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
        }
        .host-prefix {
          font-size: var(--text-2xs);
        }
      }

      /* -------- Reduced motion: keep the visual, drop the pulse -------- */
      @media (prefers-reduced-motion: reduce) {
        .live-dot {
          animation: none;
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
