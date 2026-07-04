// src/app/features/profile/ui/profile-stats-bar.ts
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-profile-stats-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stats-bar">
      <button type="button" class="stat-cell" (click)="followersClick.emit()">
        <span class="stat-val">{{ followers() }}</span>
        <span class="stat-lbl">Followers</span>
      </button>
      <button type="button" class="stat-cell" (click)="followingClick.emit()">
        <span class="stat-val">{{ following() }}</span>
        <span class="stat-lbl">Following</span>
      </button>
      <div class="stat-cell stat-cell--static">
        <span class="stat-val">{{ moments() }}</span>
        <span class="stat-lbl">Moments</span>
      </div>
      <div class="stat-cell stat-cell--static">
        <span class="stat-val">{{ likes() }}</span>
        <span class="stat-lbl">Likes</span>
      </div>
    </div>
  `,
  styles: `
    .stats-bar {
      display: flex;
      align-items: stretch;
      background: var(--color-card);
      border-radius: var(--radius-xl);
      border: 1px solid var(--color-border);
      overflow: hidden;
    }
    :host-context(.dark) .stats-bar {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }

    .stat-cell {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: var(--space-3) var(--space-2);
      border: none;
      background: transparent;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .stat-cell:not(.stat-cell--static):hover {
      background-color: var(--color-neutral-100);
    }
    :host-context(.dark) .stat-cell:not(.stat-cell--static):hover {
      background-color: var(--color-neutral-700);
    }
    .stat-cell:not(:last-child) {
      border-right: 1px solid var(--color-border);
    }
    :host-context(.dark) .stat-cell:not(:last-child) {
      border-right-color: var(--color-neutral-700);
    }
    .stat-cell--static {
      cursor: default;
    }
    .stat-cell:focus-visible {
      outline: var(--focus-ring);
      outline-offset: -2px;
    }

    .stat-val {
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      color: var(--color-text);
    }
    :host-context(.dark) .stat-val {
      color: var(--color-neutral-100);
    }

    .stat-lbl {
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .stat-lbl {
      color: var(--color-neutral-400);
    }
  `,
})
export class ProfileStatsBarComponent {
  readonly followers = input(0);
  readonly following = input(0);
  readonly moments = input(0);
  readonly likes = input(0);

  readonly followersClick = output<void>();
  readonly followingClick = output<void>();
}
