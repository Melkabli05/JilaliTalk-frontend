import { Component, ChangeDetectionStrategy, input, output, inject, signal, effect } from '@angular/core';
import { SigninStore } from './signin-store';
import { RoomApi } from '../api/room-api';
import { RewardItem, TaskItem } from '../models/room-model';
import { LucideGift, LucideX, LucideCheck, LucideStar, LucideFlame, LucideLock, LucideList } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-signin-panel',

  imports: [LucideGift, LucideX, LucideCheck, LucideStar, LucideFlame, LucideLock, LucideList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-overlay" (click)="onClose.emit()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="panel-header">
          <div class="header-left">
            <span class="header-icon">
              <svg aria-hidden="true" lucideGift [size]="16" />
            </span>
            <h2 class="panel-title">Daily Rewards</h2>
          </div>
          <button type="button" class="close-btn" (click)="onClose.emit()" aria-label="Close">
            <svg aria-hidden="true" lucideX [size]="14" />
          </button>
        </div>

        <div class="tabs">
          <button type="button" class="tab" [class.active]="activeTab() === 'signin'" (click)="activeTab.set('signin')">Daily Check-in</button>
          <button type="button" class="tab" [class.active]="activeTab() === 'rewards'" (click)="store.activateRewardsTab(); activeTab.set('rewards')">Room Rewards</button>
          <button type="button" class="tab" [class.active]="activeTab() === 'tasks'" (click)="store.activateTasksTab(); activeTab.set('tasks')">Tasks</button>
        </div>

        <div class="panel-body">
          @if (activeTab() === 'signin') {
            @if (store.signPanelLoading()) {
              <div class="loading-grid">
                @for (i of [1,2,3,4,5,6,7]; track i) {
                  <div class="skeleton-day">
                    <div class="sk-circle"></div>
                    <div class="sk-text"></div>
                  </div>
                }
              </div>
            } @else if (store.signPanelError()) {
              <div class="empty-state">
                <p class="empty-text">{{ store.signPanelError() }}</p>
                <button type="button" class="claim-btn" (click)="store.reloadSignPanel()">Retry</button>
              </div>
            } @else {
              <div class="sign-panel">
                <div class="streak-banner">
                  <svg aria-hidden="true" lucideFlame [size]="16" class="streak-icon" />
                  <span class="streak-label">{{ store.consecutiveDays() }} day streak</span>
                </div>
                <div class="sign-grid">
                  @for (item of store.signItems(); track item.signDay; let i = $index) {
                    <div
                      class="sign-day"
                      [class.signed]="item.signStatus === 1"
                      [class.locked]="item.signStatus === 3"
                      [class.today]="item.toDay"
                      [style.animation-delay.ms]="i * 30"
                    >
                      <div class="day-gift">
                        @if (item.thumb) {
                          <img [src]="item.thumb" [alt]="item.giftName" class="gift-thumb" />
                        } @else {
                          <span class="gift-icon">🎁</span>
                        }
                        @if (item.signStatus === 1) {
                          <span class="status-badge status-claimed">
                            <svg aria-hidden="true" lucideCheck [size]="11" />
                          </span>
                        } @else if (item.signStatus === 3) {
                          <span class="status-badge status-locked">
                            <svg aria-hidden="true" lucideLock [size]="10" />
                          </span>
                        }
                      </div>
                      <span class="day-label">Day {{ item.signDay }}</span>
                      <span class="gift-name">{{ item.giftName }}</span>
                      @if (item.toDay && item.signStatus !== 1) {
                        <svg aria-hidden="true" lucideStar [size]="10" class="today-badge" />
                      }
                    </div>
                  }
                </div>
              </div>
            }
          } @else if (activeTab() === 'rewards') {
            @if (store.rewardsLoading()) {
              <div class="loading-grid">
                @for (i of [1,2,3,4,5,6,7]; track i) {
                  <div class="skeleton-day">
                    <div class="sk-circle"></div>
                    <div class="sk-text"></div>
                  </div>
                }
              </div>
            } @else if (store.rewardsError()) {
              <div class="empty-state">
                <p class="empty-text">{{ store.rewardsError() }}</p>
                <button type="button" class="claim-btn" (click)="store.reloadRewards()">Retry</button>
              </div>
            } @else {
              <div class="rewards-panel">
                <div class="room-level-banner">
                  @if (roomLevelIcon()) {
                    <img [src]="roomLevelIcon()!" alt="" class="room-level-icon" />
                  } @else {
                    <span class="room-level-icon room-level-icon-fallback">{{ roomLevel() }}</span>
                  }
                  <span class="room-level-label">Room Level {{ roomLevel() }}</span>
                </div>
                @if (store.rewardItems().length === 0) {
                  <div class="empty-state">
                    @if (store.currentLevel() < 2) {
                      <p class="empty-text">Level up to unlock rewards</p>
                      @if (store.nextLevelExp() !== null) {
                        <div class="xp-bar-wrap">
                          <div class="xp-bar">
                            <div class="xp-bar-fill" [style.width.%]="store.levelProgress() * 100"></div>
                          </div>
                          <span class="xp-label">LV{{ store.currentLevel() }} → LV{{ store.currentLevel() + 1 }}</span>
                        </div>
                      }
                    } @else {
                      <p class="empty-text">No rewards for this level</p>
                    }
                  </div>
                } @else {
                  <div class="rewards-list">
                    @for (item of store.rewardItems(); track item.id; let i = $index) {
                      <div class="reward-item" [class.claimed]="store.isRewardClaimed(item.id)" [style.animation-delay.ms]="i * 40">
                        <div class="reward-icon-wrap">
                          @if (item.icon) {
                            <img [src]="item.icon" [alt]="item.name" class="reward-icon-img" />
                          } @else {
                            <span class="reward-icon">{{ getGiftEmoji(item.giftId) }}</span>
                          }
                        </div>
                        <div class="reward-info">
                          <span class="reward-name">{{ item.name }}</span>
                          <span class="reward-count">× {{ item.number }}</span>
                        </div>
                        @if (store.isRewardClaimed(item.id)) {
                          <span class="claimed-badge">
                            <svg aria-hidden="true" lucideCheck [size]="12" />
                            Claimed
                          </span>
                        } @else {
                          <button
                            type="button"
                            class="claim-btn"
                            (click)="onClaimReward(item)"
                            [disabled]="claiming()"
                          >
                            Claim
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          } @else {
            @if (store.tasksLoading()) {
              <div class="loading-grid">
                @for (i of [1,2,3,4]; track i) {
                  <div class="skeleton-day">
                    <div class="sk-circle"></div>
                    <div class="sk-text"></div>
                  </div>
                }
              </div>
            } @else if (store.tasksError()) {
              <div class="empty-state">
                <p class="empty-text">{{ store.tasksError() }}</p>
                <button type="button" class="claim-btn" (click)="store.reloadTasks()">Retry</button>
              </div>
            } @else if (store.taskItems().length === 0) {
              <div class="empty-state">
                <p class="empty-text">No tasks available</p>
              </div>
            } @else {
              <div class="tasks-list">
                @for (task of store.taskItems(); track task.taskId; let i = $index) {
                  <div
                    class="task-item"
                    [class.claimed]="store.isTaskClaimed(task.taskId) || task.status === 2"
                    [class.locked]="task.status === 3"
                    [style.animation-delay.ms]="i * 40"
                  >
                    <div class="task-icon-wrap">
                      @if (task.rewardIcon) {
                        <img [src]="task.rewardIcon" [alt]="task.rewardName ?? ''" class="task-icon-img" />
                      } @else {
                        <svg aria-hidden="true" lucideList [size]="18" class="task-icon" />
                      }
                    </div>
                    <div class="task-info">
                      <span class="task-name">{{ task.name }}</span>
                      @if (task.description) {
                        <span class="task-desc">{{ task.description }}</span>
                      }
                      <span class="task-reward">
                        @if (task.rewardName) {
                          {{ task.rewardName }}
                        } @else {
                          +{{ task.rewardAmount }}
                        }
                      </span>
                    </div>
                    @if (store.isTaskClaimed(task.taskId) || task.status === 2) {
                      <span class="claimed-badge">
                        <svg aria-hidden="true" lucideCheck [size]="12" />
                        Done
                      </span>
                    } @else if (task.status === 3) {
                      <span class="locked-badge">
                        <svg aria-hidden="true" lucideLock [size]="12" />
                        Locked
                      </span>
                    } @else {
                      <button
                        type="button"
                        class="claim-btn"
                        (click)="onClaimTask(task)"
                        [disabled]="claimingTask()"
                      >
                        Claim
                      </button>
                    }
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      /* Theming tokens */
      --sp-skeleton-from: var(--color-neutral-200);
      --sp-skeleton-mid: var(--color-neutral-100);
      --sp-skeleton-to: var(--color-neutral-200);
      --sp-tabs-bg: var(--color-neutral-100);
      --sp-tab-active-bg: var(--color-card);
      --sp-tab-active-fg: var(--color-primary-600);
      --sp-close-bg: color-mix(in srgb, var(--color-card) 70%, transparent);
      --sp-close-hover-bg: var(--color-neutral-200);
      --sp-streak-fg: var(--color-gold-600);
      --sp-streak-border: var(--color-gold-200);
      --sp-day-bg: var(--color-neutral-50);
      --sp-today-bg: var(--color-primary-50);
      --sp-signed-border: var(--color-gold-200);
      --sp-status-locked-bg: var(--color-neutral-300);
      --sp-status-locked-fg: var(--color-neutral-600);
      --sp-card-bg: var(--color-neutral-50);
      --sp-card-border: var(--color-border);
      --sp-task-icon-bg: color-mix(in srgb, var(--color-primary-50) 60%, var(--color-card));
      --sp-locked-bg: var(--color-neutral-200);
      --sp-locked-fg: var(--color-text-muted);
      --sp-xp-track: var(--color-neutral-200);
      --sp-body-scroll: var(--color-neutral-300);
    }
    :host-context(.dark) {
      --sp-skeleton-from: var(--color-neutral-700);
      --sp-skeleton-mid: var(--color-neutral-600);
      --sp-skeleton-to: var(--color-neutral-700);
      --sp-tabs-bg: var(--color-neutral-900);
      --sp-tab-active-bg: var(--color-neutral-700);
      --sp-tab-active-fg: var(--color-primary-300);
      --sp-close-bg: color-mix(in srgb, var(--color-neutral-900) 40%, transparent);
      --sp-close-hover-bg: var(--color-neutral-600);
      --sp-streak-fg: var(--color-gold-300);
      --sp-streak-border: color-mix(in srgb, var(--color-gold-500) 30%, transparent);
      --sp-today-bg: color-mix(in srgb, var(--color-primary-700) 25%, transparent);
      --sp-signed-border: color-mix(in srgb, var(--color-gold-500) 30%, transparent);
      --sp-status-locked-bg: var(--color-neutral-600);
      --sp-status-locked-fg: var(--color-neutral-300);
      --sp-card-bg: var(--color-neutral-800);
      --sp-task-icon-bg: color-mix(in srgb, var(--color-primary-900) 50%, var(--color-neutral-800));
      --sp-locked-bg: var(--color-neutral-700);
      --sp-locked-fg: var(--color-neutral-400);
      --sp-xp-track: var(--color-neutral-700);
      --sp-body-scroll: var(--color-neutral-600);
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--color-black) 55%, transparent);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal);
      animation: fadeIn 0.15s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .modal-content {
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-2xl);
      width: 400px;
      max-width: calc(100vw - var(--space-8));
      max-height: 80dvh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-xl), var(--shadow-modal);
      animation: slideUp 0.2s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .modal-overlay, .modal-content { animation: none; }
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4);
      border-bottom: 1px solid var(--color-border);
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-gold-100) 70%, transparent),
        color-mix(in srgb, var(--color-primary-100) 35%, transparent)
      );
    }
    :host-context(.dark) .panel-header {
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-gold-700) 25%, transparent),
        color-mix(in srgb, var(--color-primary-700) 20%, transparent)
      );
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .header-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--icon-btn-size);
      height: var(--icon-btn-size);
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--color-gold-300) 35%, var(--color-card));
      color: var(--color-gold-500);
      box-shadow: var(--shadow-xs);
    }
    :host-context(.dark) .header-icon {
      background: color-mix(in srgb, var(--color-gold-700) 35%, var(--color-card));
      color: var(--color-gold-300);
    }
    .panel-title {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: 0;
    }
    .close-btn {
      width: var(--icon-btn-size);
      height: var(--icon-btn-size);
      border-radius: var(--radius-full);
      border: none;
      background: var(--sp-close-bg);
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s, transform 0.15s;
    }
    .close-btn:hover {
      background: var(--sp-close-hover-bg);
      color: var(--color-text);
      transform: rotate(90deg);
    }
    .close-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    .tabs {
      display: flex;
      gap: 2px;
      margin: var(--space-3) var(--space-4) 0;
      padding: 3px;
      border-radius: var(--radius-lg);
      background: var(--sp-tabs-bg);
    }
    .tab {
      flex: 1;
      padding: var(--space-2) var(--space-3);
      background: none;
      border: none;
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .tab:hover { color: var(--color-text); }
    .tab.active {
      color: var(--sp-tab-active-fg);
      background: var(--sp-tab-active-bg);
      box-shadow: var(--shadow-xs);
      font-weight: var(--font-semibold);
    }

    .panel-body {
      padding: var(--space-4);
      overflow-y: auto;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: var(--sp-body-scroll) transparent;
    }

    .loading-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
      gap: var(--space-2);
    }
    .skeleton-day {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-2);
    }
    .sk-circle {
      width: 36px; height: 36px;
      border-radius: 50%;
    }
    .sk-text {
      width: 32px; height: 8px;
      border-radius: var(--radius-sm);
    }
    .sk-circle, .sk-text {
      background: linear-gradient(90deg, var(--sp-skeleton-from) 25%, var(--sp-skeleton-mid) 50%, var(--sp-skeleton-to) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .sk-circle, .sk-text { animation: none; }
    }

    .sign-panel { display: flex; flex-direction: column; gap: var(--space-3); }
    .streak-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, var(--color-gold-50), color-mix(in srgb, var(--color-gold-100) 70%, var(--color-gold-50)));
      border: 1px solid var(--sp-streak-border);
    }
    :host-context(.dark) .streak-banner {
      background: linear-gradient(135deg, color-mix(in srgb, var(--color-gold-700) 25%, transparent), color-mix(in srgb, var(--color-gold-600) 15%, transparent));
    }
    .streak-icon {
      color: var(--color-gold-500);
      animation: flicker 1.8s ease-in-out infinite;
    }
    @keyframes flicker {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(0.92); }
    }
    @media (prefers-reduced-motion: reduce) {
      .streak-icon { animation: none; }
    }
    .streak-label {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--sp-streak-fg);
    }
    .sign-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
      gap: var(--space-2);
    }
    .sign-day {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: var(--space-2) var(--space-1);
      border-radius: var(--radius-lg);
      background: var(--sp-day-bg);
      border: 1px solid var(--sp-card-border);
      position: relative;
      transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s, background 0.15s;
      animation: itemIn 0.25s ease-out backwards;
    }
    .sign-day:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }
    .sign-day.today {
      border-color: var(--color-primary-400);
      background: var(--sp-today-bg);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-400) 18%, transparent);
      animation: itemIn 0.25s ease-out backwards, pulseToday 2.4s ease-in-out infinite;
    }
    .sign-day.signed {
      background: linear-gradient(160deg, var(--color-gold-50), color-mix(in srgb, var(--color-gold-100) 50%, var(--color-gold-50)));
      border-color: var(--sp-signed-border);
    }
    :host-context(.dark) .sign-day.signed {
      background: color-mix(in srgb, var(--color-gold-600) 18%, transparent);
    }
    .sign-day.locked { opacity: 0.6; }
    .sign-day.locked:hover { transform: none; box-shadow: none; }
    @keyframes itemIn {
      from { opacity: 0; transform: translateY(4px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes pulseToday {
      0%, 100% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-400) 18%, transparent); }
      50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-primary-400) 8%, transparent); }
    }
    @media (prefers-reduced-motion: reduce) {
      .sign-day, .sign-day.today { animation: none; }
      .sign-day:hover { transform: none; }
    }
    .day-gift {
      width: 40px; height: 40px;
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      position: relative;
      background: var(--color-card);
      box-shadow: var(--shadow-xs);
    }
    .gift-thumb {
      width: 30px; height: 30px;
      object-fit: contain;
    }
    .sign-day.locked .gift-thumb { filter: grayscale(1); }
    .status-badge {
      position: absolute;
      bottom: -4px; right: -4px;
      width: 16px; height: 16px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--color-card);
      animation: popIn 0.25s ease-out;
    }
    .status-claimed {
      background: var(--color-gold-500);
      color: var(--color-on-color);
    }
    .status-locked {
      background: var(--sp-status-locked-bg);
      color: var(--sp-status-locked-fg);
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }
    .gift-icon { font-size: 18px; }
    .day-label {
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }
    .gift-name {
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
    .today-badge {
      position: absolute;
      top: 4px; right: 4px;
      color: var(--color-primary-500);
      animation: popIn 0.25s ease-out;
    }

    .room-level-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      margin-bottom: var(--space-3);
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, var(--color-primary-50), color-mix(in srgb, var(--color-primary-100) 60%, var(--color-primary-50)));
      border: 1px solid var(--color-primary-200);
    }
    :host-context(.dark) .room-level-banner {
      background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary-700) 25%, transparent), color-mix(in srgb, var(--color-primary-600) 15%, transparent));
      border-color: color-mix(in srgb, var(--color-primary-500) 30%, transparent);
    }
    .room-level-icon {
      width: var(--icon-btn-size);
      height: var(--icon-btn-size);
      object-fit: contain;
    }
    .room-level-icon-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-full);
      background: var(--color-primary-500);
      color: var(--color-on-color);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
    }
    .room-level-label {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-primary-600);
    }
    :host-context(.dark) .room-level-label { color: var(--color-primary-300); }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-8);
    }
    .empty-text {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
      text-align: center;
    }

    .rewards-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .reward-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      background: var(--sp-card-bg);
      border: 1px solid var(--sp-card-border);
      transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
      animation: itemIn 0.25s ease-out backwards;
    }
    .reward-item:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
      border-color: color-mix(in srgb, var(--color-primary-300) 50%, transparent);
    }
    @media (prefers-reduced-motion: reduce) {
      .reward-item { animation: none; }
      .reward-item:hover { transform: none; }
    }
    .reward-icon-wrap {
      width: 40px; height: 40px;
      border-radius: var(--radius-md);
      background: linear-gradient(160deg, var(--color-gold-50), color-mix(in srgb, var(--color-gold-100) 60%, var(--color-gold-50)));
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    :host-context(.dark) .reward-icon-wrap {
      background: color-mix(in srgb, var(--color-gold-600) 20%, transparent);
    }
    .reward-icon { font-size: 20px; }
    .reward-icon-img {
      width: var(--icon-btn-size);
      height: var(--icon-btn-size);
      object-fit: contain;
    }
    .reward-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .reward-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .reward-count {
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
    }
    .claim-btn {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-md);
      border: none;
      background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
      color: var(--color-on-color);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
      flex-shrink: 0;
    }
    .claim-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }
    .claim-btn:active:not(:disabled) { transform: translateY(0); }
    .claim-btn:disabled { opacity: 0.6; cursor: default; }
    .claim-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .reward-item.claimed { opacity: 0.65; }
    .reward-item.claimed:hover { transform: none; box-shadow: none; }
    .claimed-badge {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-md);
      background: var(--color-gold-500);
      color: var(--color-on-color);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      flex-shrink: 0;
    }
    .xp-bar-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      width: 100%;
    }
    .xp-bar {
      width: 100%;
      height: 6px;
      border-radius: var(--radius-full);
      background: var(--sp-xp-track);
      overflow: hidden;
    }
    .xp-bar-fill {
      height: 100%;
      border-radius: var(--radius-full);
      background: linear-gradient(90deg, var(--color-primary-400), var(--color-primary-500));
      transition: width 0.4s ease;
    }
    .xp-label {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .tasks-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .task-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      background: var(--sp-card-bg);
      border: 1px solid var(--sp-card-border);
      transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
      animation: itemIn 0.25s ease-out backwards;
    }
    .task-item:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
      border-color: color-mix(in srgb, var(--color-primary-300) 50%, transparent);
    }
    @media (prefers-reduced-motion: reduce) {
      .task-item { animation: none; }
      .task-item:hover { transform: none; }
    }
    .task-item.claimed { opacity: 0.65; }
    .task-item.claimed:hover { transform: none; box-shadow: none; }
    .task-item.locked { opacity: 0.5; }
    .task-item.locked:hover { transform: none; box-shadow: none; }
    .task-icon-wrap {
      width: 40px; height: 40px;
      border-radius: var(--radius-md);
      background: var(--sp-task-icon-bg);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .task-icon { color: var(--color-primary-500); }
    .task-icon-img {
      width: 24px; height: 24px;
      object-fit: contain;
    }
    .task-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .task-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .task-desc {
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .task-reward {
      font-size: var(--text-2xs);
      color: var(--color-gold-600);
      font-weight: var(--font-semibold);
    }
    :host-context(.dark) .task-reward { color: var(--color-gold-300); }
    .locked-badge {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-md);
      background: var(--sp-locked-bg);
      color: var(--sp-locked-fg);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      flex-shrink: 0;
    }
  `],
})
export class SigninPanelComponent {
  readonly onClose = output<void>();

  readonly store = inject(SigninStore);
  private readonly api = inject(RoomApi);
  readonly cname = input.required<string>();
  readonly hostId = input.required<number>();
  readonly roomLevel = input<number>(1);
  readonly roomLevelIcon = input<string | null>(null);

  readonly activeTab = signal<'signin' | 'rewards' | 'tasks'>('signin');
  readonly claiming = signal(false);
  readonly claimingTask = signal(false);

  constructor() {
    effect(() => this.store.setParams(this.cname(), this.hostId(), this.roomLevel()));
  }

  onClaimReward(item: RewardItem): void {
    this.claiming.set(true);
    firstValueFrom(this.api.claimRoomLevelReward(this.cname(), this.hostId()))
      .then(() => this.store.markRewardClaimed(item.id))
      .catch(() => undefined)
      .finally(() => this.claiming.set(false));
  }

  onClaimTask(task: TaskItem): void {
    this.claimingTask.set(true);
    firstValueFrom(this.api.claimTaskReward(this.cname(), this.hostId(), task.taskId))
      .then(() => this.store.markTaskClaimed(task.taskId))
      .catch(() => undefined)
      .finally(() => this.claimingTask.set(false));
  }

  getGiftEmoji(giftId: number): string {
    const emojiMap: Record<number, string> = {
      53: '🎤',
      175: '🎧',
      14: '🐰',
      31: '💝',
    };
    return emojiMap[giftId] ?? '🎁';
  }
}