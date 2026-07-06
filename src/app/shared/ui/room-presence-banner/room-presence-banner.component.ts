import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import type { UserPresence, UserInfo } from '@core/services/user-info.service';

@Component({
  selector: 'app-room-presence-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, ButtonComponent, CountryFlagComponent],
  template: `
    @if (presence(); as p) {
      @if (shouldShow()) {
        <section class="presence-banner" [class.hosting]="isHosting()" aria-label="Currently in a room">
          <div class="accent-strip" aria-hidden="true"></div>
          <div class="banner-body">
            <header class="banner-header">
              <span class="live-dot" aria-hidden="true"></span>
              <span class="header-label">{{ headerLabel() }}</span>
            </header>

            <div class="room-name" [title]="p.cname">{{ roomNameLabel() }}</div>

            @if (hostRowVisible()) {
              <div class="host-row">
                <div class="host-avatar-wrap">
                  <app-avatar
                    [src]="hostAvatarSrc()"
                    [alt]="hostName() ?? 'Host'"
                    [initials]="hostInitials()"
                    size="xs"
                  />
                </div>
                <div class="host-meta">
                  <span class="host-prefix">Hosted by</span>
                  <span class="host-name">{{ hostName() }}</span>
                  @if (hostNationality(); as code) {
                    <app-country-flag [code]="code" />
                  }
                </div>
              </div>
            }

            <div class="actions">
              <app-button variant="primary" size="sm" (click)="onJoin(true)">Join Visible</app-button>
              <app-button variant="soft-neutral" size="sm" (click)="onJoin(false)">Join as Guest</app-button>
            </div>
          </div>
        </section>
      }
    }
  `,
  styles: [`
    /* ---- Container ---- */
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
      transition: box-shadow 0.15s ease, transform 0.15s ease;
    }
    :host-context(.dark) .presence-banner {
      background: color-mix(in srgb, var(--color-accent-500) 8%, var(--color-neutral-800));
      border-color: var(--color-neutral-700);
      box-shadow: 0 1px 0 0 color-mix(in srgb, var(--color-accent-500) 12%, transparent) inset;
    }

    /* ---- Accent strip (the visual anchor) ---- */
    .accent-strip {
      flex: 0 0 4px;
      background: linear-gradient(180deg, var(--color-accent-400), var(--color-accent-600));
    }
    :host-context(.dark) .accent-strip {
      background: linear-gradient(180deg, var(--color-accent-500), var(--color-accent-700));
      box-shadow: 0 0 8px 0 color-mix(in srgb, var(--color-accent-500) 35%, transparent);
    }
    /* Hosting state: shift the strip to gold so the visual language reinforces the role. */
    .presence-banner.hosting .accent-strip {
      background: linear-gradient(180deg, var(--color-gold-300), var(--color-gold-500));
    }
    :host-context(.dark) .presence-banner.hosting .accent-strip {
      background: linear-gradient(180deg, var(--color-gold-500), var(--color-gold-700));
    }

    /* ---- Inner content (the strip is the sibling, not the parent) ---- */
    .banner-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      min-width: 0;
    }

    /* ---- Header row ---- */
    .banner-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    /* Pulsing live dot — the universal "currently active" signal. Animation respects
       prefers-reduced-motion (overridden below). */
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-accent-500);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-500) 60%, transparent);
      animation: live-pulse 1.8s ease-out infinite;
      flex-shrink: 0;
    }
    :host-context(.dark) .live-dot {
      background: var(--color-accent-400);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-400) 70%, transparent);
    }
    /* Hosting: warm gold dot instead of accent green. */
    .presence-banner.hosting .live-dot {
      background: var(--color-gold-500);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-gold-500) 60%, transparent);
    }
    :host-context(.dark) .presence-banner.hosting .live-dot {
      background: var(--color-gold-400);
    }
    @keyframes live-pulse {
      0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-500) 60%, transparent); }
      70%  { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent-500) 0%, transparent); }
      100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-500) 60%, transparent); }
    }
    :host-context(.dark) @keyframes live-pulse {
      0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-400) 70%, transparent); }
      70%  { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent-400) 0%, transparent); }
      100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-400) 70%, transparent); }
    }
    .presence-banner.hosting @keyframes live-pulse {
      0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-gold-500) 60%, transparent); }
      70%  { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-gold-500) 0%, transparent); }
      100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-gold-500) 60%, transparent); }
    }
    :host-context(.dark) .presence-banner.hosting @keyframes live-pulse {
      0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-gold-400) 70%, transparent); }
      70%  { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-gold-400) 0%, transparent); }
      100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-gold-400) 70%, transparent); }
    }
    @media (prefers-reduced-motion: reduce) {
      .live-dot { animation: none; }
    }

    .header-label {
      font-size: var(--text-2xs);
      font-weight: var(--font-bold);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    :host-context(.dark) .header-label { color: var(--color-neutral-400); }

    /* ---- Room name ---- */
    .room-name {
      font-size: var(--text-base);
      font-weight: var(--font-bold);
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.2;
    }
    :host-context(.dark) .room-name { color: var(--color-neutral-50); }

    /* ---- Host row (statusType=2 only) ---- */
    .host-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) 0;
    }
    .host-avatar-wrap {
      position: relative;
      flex-shrink: 0;
    }
    /* Soft accent ring around the host avatar — gives the avatar a small visual weight
       to balance against the larger identity-card avatar above. */
    .host-avatar-wrap::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-accent-300), var(--color-accent-500));
      z-index: 0;
    }
    .host-avatar-wrap app-avatar {
      position: relative;
      z-index: 1;
    }
    :host-context(.dark) .host-avatar-wrap::before {
      background: linear-gradient(135deg, var(--color-accent-500), var(--color-accent-700));
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
    :host-context(.dark) .host-prefix { color: var(--color-neutral-400); }
    .host-name {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
    :host-context(.dark) .host-name { color: var(--color-neutral-200); }

    /* ---- Actions ---- */
    .actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }
    .actions app-button { flex: 1; }
  `],
})
export class RoomPresenceBannerComponent {
  readonly presence = input<UserPresence | null>(null);
  readonly hostInfo = input<UserInfo | null>(null);
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

  readonly hostName = computed(() => this.hostInfo()?.nickname ?? null);

  readonly hostAvatarSrc = computed(() => this.hostInfo()?.details?.base?.headUrl ?? '');

  readonly hostInitials = computed(() => {
    const n = this.hostName();
    return n ? n.slice(0, 2) : 'H';
  });

  readonly hostNationality = computed(() => {
    const info = this.hostInfo();
    return info?.nationality ?? info?.details?.base?.nationality ?? null;
  });

  onJoin(visible: boolean): void {
    this.join.emit({ visible });
  }
}