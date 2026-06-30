import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { Listbox, Option } from '@angular/aria/listbox';
import { ManagersStore } from './managers-store';
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
    <app-modal [title]="'Room Managers'" [count]="store.managers().length > 0 ? store.managers().length : null">
      @if (store.loading()) {
        <div class="loading-list">
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-item">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-text"></div>
            </div>
          }
        </div>
      } @else if (store.error()) {
        <div class="empty-state">
          <span class="empty-icon-circle error">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <p class="empty-text">{{ store.error() }}</p>
          <button type="button" class="retry-btn" (click)="store.reload()">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 5.51 19"/></svg>
            Retry
          </button>
        </div>
      } @else if (store.managers().length === 0) {
        <div class="empty-state">
          <span class="empty-icon-circle">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </span>
          <p class="empty-text">No managers yet</p>
          <p class="empty-sub">Promote members to help manage this room</p>
        </div>
      } @else {
        <ul ngListbox [readonly]="true" [multi]="false" aria-label="Room managers" class="managers-list">
          @for (manager of store.managers(); track manager.userId; let i = $index) {
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
    :host { display: block; width: 380px; max-width: calc(100vw - var(--space-8)); }

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
      background: var(--color-neutral-200);
      animation: shimmer 1.4s infinite;
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
    }
    .skeleton-text {
      flex: 1;
      height: 14px;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    :host-context(.dark) .skeleton-avatar,
    :host-context(.dark) .skeleton-text {
      background: linear-gradient(90deg, var(--color-neutral-700) 25%, var(--color-neutral-600) 50%, var(--color-neutral-700) 75%);
      background-size: 200% 100%;
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
      background: var(--color-neutral-100);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .empty-icon-circle { background: var(--color-neutral-700); }
    .empty-icon-circle.error { background: var(--color-warm-50); color: var(--color-warm-500); }
    :host-context(.dark) .empty-icon-circle.error { background: color-mix(in srgb, var(--color-warm-600) 25%, transparent); }
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
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-card);
      color: var(--color-text);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      padding: var(--space-1) var(--space-3);
      cursor: pointer;
      transition: background 0.15s;
    }
    .retry-btn:hover { background: var(--color-neutral-50); }
    :host-context(.dark) .retry-btn { background: var(--color-neutral-800); border-color: var(--color-neutral-700); color: var(--color-neutral-200); }
    :host-context(.dark) .retry-btn:hover { background: var(--color-neutral-700); }
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
    .manager-item:hover { background: var(--color-neutral-50); transform: translateX(2px); }
    .manager-item:focus-visible { outline: var(--focus-ring); outline-offset: -2px; background: var(--color-neutral-50); }
    :host-context(.dark) .manager-item:hover,
    :host-context(.dark) .manager-item:focus-visible { background: var(--color-neutral-700); }

    .manager-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .manager-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host-context(.dark) .manager-name { color: var(--color-neutral-100); }

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
    :host-context(.dark) .role-badge { color: var(--color-primary-300); background: var(--color-primary-900); }
    .offline-badge {
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      padding: 1px 6px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-100);
      color: var(--color-text-muted);
      flex-shrink: 0;
    }
    :host-context(.dark) .offline-badge { background: var(--color-neutral-700); color: var(--color-neutral-300); }
    .stay-time {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .stay-time { color: var(--color-neutral-400); }

    .remove-btn {
      width: 28px;
      height: 28px;
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
    .remove-btn:hover { background: var(--color-warm-50); color: var(--color-warm-600); }
    .remove-btn:disabled { opacity: 1; cursor: not-allowed; color: var(--color-text-muted); }
    :host-context(.dark) .remove-btn:hover { background: var(--color-warm-600); color: var(--color-warm-50); }
  `],
})
export class ManagersModalComponent {
  readonly ref = inject(DialogRef<void>);
  readonly data = inject<ManagersModalData>(DIALOG_DATA);
  readonly store = inject(ManagersStore);
  private readonly api = inject(RoomApi);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(Dialog);

  readonly removingId = signal<number | null>(null);

  constructor() {
    this.store.setParams(this.data.cname, this.data.hostId);
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
      .then(() => this.store.reload())
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
