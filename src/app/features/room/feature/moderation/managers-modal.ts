import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { Listbox, Option } from '@angular/aria/listbox';
import { MANAGERS_READER, MANAGERS_WRITER } from './managers-store';
import { RoomApi } from '../../data/room-api';
import { Manager } from '../../data/room-model';
import { ToastService } from '@core/services/toast.service';
import { UserInfoModalComponent, UserInfoModalData } from '@shared/ui/user-info-modal/user-info-modal.component';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { firstValueFrom } from 'rxjs';
import { initialsFrom } from '@shared/utils';

export interface ManagersModalData {
  readonly cname: string;
  readonly hostId: number;
  readonly busiType: number;
  readonly isHost: boolean;
}

@Component({
  selector: 'app-managers-modal',
  imports: [
    ModalComponent,
    AvatarComponent,
    CountryFlagComponent,
    TooltipDirective,
    Listbox,
    Option,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="'Room Managers'" [count]="reader.managers().length > 0 ? reader.managers().length : null">
      @if (reader.loading()) {
        <div class="loading-list">
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-item">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-text"></div>
            </div>
          }
        </div>
      } @else if (reader.error()) {
        <div class="empty-state">
          <span class="empty-icon-circle error">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <p class="empty-text">{{ reader.error() }}</p>
          <button type="button" class="retry-btn" (click)="writer.reload()">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 5.51 19"/></svg>
            Retry
          </button>
        </div>
      } @else if (reader.managers().length === 0) {
        <div class="empty-state">
          <span class="empty-icon-circle">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </span>
          <p class="empty-text">No managers yet</p>
          <p class="empty-sub">Promote members to help manage this room</p>
        </div>
      } @else {
        <ul ngListbox [readonly]="true" [multi]="false" aria-label="Room managers" class="managers-list">
          @for (manager of reader.managers(); track manager.userId; let i = $index) {
            <li
              ngOption
              [value]="manager.userId"
              [label]="manager.nickname"
              class="manager-item"
              [style.animation-delay.ms]="i * 30"
              (click)="onViewProfile(manager)"
              (keydown.enter)="onViewProfile(manager)"
            >
              <app-avatar
                [src]="manager.headUrl ?? ''"
                [initials]="getInitials(manager.nickname)"
                size="sm"
                ringColor="var(--color-primary-300)"
                [alt]="manager.nickname"
              />
              <div class="manager-info">
                <span class="manager-name">{{ manager.nickname }}</span>
                <div class="manager-meta">
                  <span class="role-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Moderator
                  </span>
                  @if (manager.nationality) {
                    <app-country-flag [code]="manager.nationality" />
                  }
                  @if (manager.isInRoom) {
                    <span class="stay-time">
                      {{ formatStay(manager.stayTime) }}
                    </span>
                  }
                </div>
              </div>
              @if (!manager.isInRoom) {
                <span class="offline-badge">Offline</span>
              }
              @if (data.isHost) {
                <button
                  type="button"
                  class="remove-btn"
                  [disabled]="removingId() === manager.userId"
                  (click)="onRemove(manager.userId, $event)"
                  [attr.aria-label]="'Remove ' + manager.nickname + ' as manager'"
                  appTooltip="Remove"
                  tooltipPosition="left"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>
                </button>
              }
            </li>
          }
        </ul>
      }
    </app-modal>
  `,
  styles: [`
    :host {
      display: block;
      width: 380px;
      max-width: calc(100vw - var(--space-8));

      --mm-skeleton-from: var(--color-neutral-200);
      --mm-skeleton-mid: var(--color-neutral-100);
      --mm-skeleton-to: var(--color-neutral-200);
      --mm-hover-bg: var(--color-neutral-50);
      --mm-empty-bg: var(--color-neutral-100);
      --mm-empty-icon-color: var(--color-text-muted);
      --mm-retry-bg: var(--color-card);
      --mm-retry-border: var(--color-border);
      --mm-retry-color: var(--color-text);
      --mm-retry-hover-bg: var(--color-neutral-50);
      --mm-name-color: var(--color-text);
      --mm-offline-bg: var(--color-neutral-100);
      --mm-offline-fg: var(--color-text-muted);
      --mm-stay-fg: var(--color-text-muted);
      --mm-remove-hover-bg: var(--color-warm-50);
      --mm-remove-hover-fg: var(--color-warm-600);
    }
    :host-context(.dark) {
      --mm-skeleton-from: var(--color-neutral-700);
      --mm-skeleton-mid: var(--color-neutral-600);
      --mm-skeleton-to: var(--color-neutral-700);
      --mm-hover-bg: var(--color-neutral-700);
      --mm-empty-bg: var(--color-neutral-700);
      --mm-empty-icon-color: var(--color-text-muted);
      --mm-retry-bg: var(--color-neutral-800);
      --mm-retry-border: var(--color-neutral-700);
      --mm-retry-color: var(--color-neutral-200);
      --mm-retry-hover-bg: var(--color-neutral-700);
      --mm-name-color: var(--color-neutral-100);
      --mm-offline-bg: var(--color-neutral-700);
      --mm-offline-fg: var(--color-neutral-300);
      --mm-stay-fg: var(--color-neutral-400);
      --mm-remove-hover-bg: var(--color-warm-600);
      --mm-remove-hover-fg: var(--color-warm-50);
    }

    .loading-list { display: flex; flex-direction: column; gap: var(--space-2); }
    .skeleton-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2);
    }
    .skeleton-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(90deg, var(--mm-skeleton-from) 25%, var(--mm-skeleton-mid) 50%, var(--mm-skeleton-to) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .skeleton-text {
      flex: 1;
      height: 14px;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--mm-skeleton-from) 25%, var(--mm-skeleton-mid) 50%, var(--mm-skeleton-to) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
    }
    .empty-icon-circle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-full);
      background: var(--mm-empty-bg);
      color: var(--mm-empty-icon-color);
    }
    .empty-icon-circle.error {
      background: var(--color-warm-50);
      color: var(--color-warm-500);
    }
    :host-context(.dark) .empty-icon-circle.error {
      background: color-mix(in srgb, var(--color-warm-600) 25%, transparent);
    }
    .empty-text {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      margin: 0;
      text-align: center;
    }
    .empty-sub {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: 0;
      text-align: center;
    }

    .retry-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      border: 1px solid var(--mm-retry-border);
      border-radius: var(--radius-md);
      background: var(--mm-retry-bg);
      color: var(--mm-retry-color);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      padding: var(--space-1) var(--space-3);
      cursor: pointer;
      transition: background 0.15s;
    }
    .retry-btn:hover { background: var(--mm-retry-hover-bg); }
    .retry-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    .managers-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 400px;
      overflow-y: auto;
    }

    .manager-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-lg);
      transition: background 0.15s, transform 0.15s;
      cursor: pointer;
      animation: itemIn 0.25s ease-out backwards;
    }
    @keyframes itemIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .manager-item:hover { background: var(--mm-hover-bg); transform: translateX(2px); }
    .manager-item:focus-visible {
      outline: var(--focus-ring);
      outline-offset: -2px;
      background: var(--mm-hover-bg);
    }

    .manager-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .manager-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--mm-name-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .manager-meta { display: flex; align-items: center; gap: var(--space-2); }
    .role-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: var(--text-2xs);
      font-weight: var(--font-medium);
      color: var(--color-primary-600);
      background: var(--color-primary-50);
      border-radius: var(--radius-full);
      padding: 1px 6px;
    }
    :host-context(.dark) .role-badge {
      color: var(--color-primary-300);
      background: var(--color-primary-900);
    }
    .offline-badge {
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      padding: 1px 6px;
      border-radius: var(--radius-full);
      background: var(--mm-offline-bg);
      color: var(--mm-offline-fg);
      flex-shrink: 0;
    }
    .stay-time {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: var(--text-2xs);
      color: var(--mm-stay-fg);
    }

    .remove-btn {
      width: var(--icon-btn-size);
      height: var(--icon-btn-size);
      border-radius: var(--radius-full);
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      opacity: 0;
      transform: scale(0.85);
      transition: opacity 0.15s, transform 0.15s, background 0.15s, color 0.15s;
    }
    .manager-item:hover .remove-btn,
    .manager-item:focus-within .remove-btn,
    .manager-item:focus-visible .remove-btn {
      opacity: 1;
      transform: scale(1);
    }
    .remove-btn:hover {
      background: var(--mm-remove-hover-bg);
      color: var(--mm-remove-hover-fg);
    }
    .remove-btn:disabled { opacity: 1; cursor: not-allowed; color: var(--color-text-muted); }
  `],
})
export class ManagersModalComponent {
  readonly ref = inject(DialogRef<void>);
  readonly data = inject<ManagersModalData>(DIALOG_DATA);
  readonly reader = inject(MANAGERS_READER);
  protected readonly writer = inject(MANAGERS_WRITER);
  private readonly api = inject(RoomApi);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(Dialog);

  readonly removingId = signal<number | null>(null);

  constructor() {
    this.writer.setParams(this.data.cname, this.data.hostId);
  }

  onViewProfile(manager: Manager): void {
    this.dialog.open(UserInfoModalComponent, {
      data: {
        userId: manager.userId,
        nickname: manager.nickname,
        headUrl: manager.headUrl,
        nationality: manager.nationality,
      } satisfies UserInfoModalData,
      backdropClass: 'app-modal-backdrop',
    });
  }

  onRemove(userId: number, event: Event): void {
    event.stopPropagation();
    if (this.removingId() !== null) return;
    this.removingId.set(userId);
    firstValueFrom(this.api.setManager(this.data.cname, this.data.busiType, userId, 2))
      .then(() => this.writer.reload())
      .catch(() => this.toast.error('Could not remove manager. Try again.'))
      .finally(() => this.removingId.set(null));
  }

  getInitials(nickname: string): string {
    return initialsFrom(nickname || 'U');
  }

  formatStay(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  }
}
