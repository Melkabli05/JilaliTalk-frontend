import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { LucideMic } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import type { UserPresence, UserInfo } from '@core/services/user-info.service';

@Component({
  selector: 'app-room-presence-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, ButtonComponent, CountryFlagComponent, LucideMic],
  template: `
    @if (presence(); as p) {
      @if (shouldShow()) {
        <section class="presence-banner" aria-label="Currently in a room">
          <header class="banner-header">
            <svg aria-hidden="true" lucideMic [size]="12" class="header-icon"></svg>
            <span class="header-label">{{ headerLabel() }}</span>
          </header>

          <div class="room-name" [title]="p.cname">{{ roomNameLabel() }}</div>

          @if (hostRowVisible()) {
            <div class="host-row">
              <app-avatar
                [src]="hostAvatarSrc()"
                [alt]="hostName() ?? 'Host'"
                [initials]="hostInitials()"
                size="xs"
              />
              <div class="host-meta">
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
        </section>
      }
    }
  `,
  styles: [`
    .presence-banner {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      margin: 0 var(--space-4) 0;
    }
    :host-context(.dark) .presence-banner {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }
    .banner-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .header-icon { color: var(--color-accent-500); flex-shrink: 0; }
    .header-label {
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    :host-context(.dark) .header-label { color: var(--color-neutral-400); }
    .room-name {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host-context(.dark) .room-name { color: var(--color-neutral-100); }
    .host-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) 0;
    }
    .host-meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      flex: 1;
    }
    .host-name {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host-context(.dark) .host-name { color: var(--color-neutral-300); }
    .actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-1);
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