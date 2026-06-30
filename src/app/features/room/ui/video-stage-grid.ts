import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { StageUser } from '../data/room-model';
import { sortByStageRole } from './stage-sort.util';
import { LucideUsers, LucideVideo } from '@lucide/angular';
import { VideoStageUserComponent, PlayableVideoTrack } from './video-stage-user';

@Component({
  selector: 'app-video-stage-grid',
  imports: [VideoStageUserComponent, LucideUsers, LucideVideo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage-card">
      <header class="stage-header">
        <div class="header-left">
          <svg aria-hidden="true" lucideVideo size="14" class="header-icon"></svg>
          <h3 class="header-title">Live Stage</h3>
        </div>
        @if (stageCount() > 0) {
          <span class="stage-count">{{ stageCount() }}/{{ maxStageSize() }}</span>
        }
      </header>

      @if (stageCount() > 0) {
        <div class="stage-grid" [attr.data-count]="stageCount()">
          @for (user of sortedStageUsers(); track user.userId) {
            <app-video-stage-user
              [user]="user"
              [videoTrack]="videoTrackForUser(user.userId)"
              [speaking]="speakingUids().includes(user.userId)"
              (userClick)="userClick.emit($event)"
            />
          }
        </div>
      } @else {
        <div class="stage-empty">
          <svg lucideUsers size="24" class="empty-icon"></svg>
          <p class="empty-text">No speakers yet</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }

      .stage-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        border: 1px solid var(--color-border);
        background: var(--color-card);
        overflow: hidden;
      }

      .stage-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--color-border);
        background: var(--color-neutral-50);
        flex-shrink: 0;
      }
      :host-context(.dark) .stage-header {
        background: var(--color-neutral-800);
        border-color: var(--color-neutral-700);
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .header-icon {
        color: var(--color-primary-500);
      }
      :host-context(.dark) .header-icon {
        color: var(--color-primary-400);
      }

      .header-title {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text);
        margin: 0;
      }
      :host-context(.dark) .header-title {
        color: var(--color-neutral-100);
      }

      .stage-count {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        background: var(--color-neutral-100);
        padding: 1px 6px;
        border-radius: var(--radius-full);
      }
      :host-context(.dark) .stage-count {
        background: var(--color-neutral-700);
        color: var(--color-neutral-400);
      }

      .stage-grid {
        display: grid;
        gap: var(--space-3);
        padding: var(--space-3);
        overflow: hidden;
        height: 100%;
        grid-template-columns: repeat(2, 1fr);
      }

      .stage-grid[data-count='1'] {
        grid-template-columns: 1fr;
      }

      .stage-grid[data-count='2'] {
        grid-template-columns: repeat(2, 1fr);
      }

      .stage-grid[data-count='3'] {
        grid-template-columns: repeat(3, 1fr);
      }

      .stage-grid[data-count='4'] {
        grid-template-columns: repeat(2, 1fr);
      }

      .stage-grid::-webkit-scrollbar {
        width: 6px;
      }
      .stage-grid::-webkit-scrollbar-thumb {
        background: var(--color-neutral-200);
        border-radius: var(--radius-full);
      }
      :host-context(.dark) .stage-grid::-webkit-scrollbar-thumb {
        background: var(--color-neutral-600);
      }
      .stage-grid::-webkit-scrollbar-track {
        background: transparent;
      }

      .stage-empty {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        color: var(--color-text-muted);
      }
      :host-context(.dark) .stage-empty {
        color: var(--color-neutral-400);
      }

      .empty-icon {
        opacity: 0.4;
      }

      .empty-text {
        font-size: var(--text-sm);
        margin: 0;
      }
    `,
  ],
})
export class VideoStageGridComponent {
  readonly users = input<readonly StageUser[]>([]);
  readonly videoTracks = input<ReadonlyMap<number, PlayableVideoTrack>>(new Map());
  readonly speakingUids = input<readonly number[]>([]);
  readonly maxStageSize = input(4);
  readonly userClick = output<StageUser>();

  readonly sortedStageUsers = computed(() => sortByStageRole(this.users()));
  readonly stageCount = computed(() => this.users().length);

  videoTrackForUser(uid: number): PlayableVideoTrack | null {
    return this.videoTracks().get(uid) ?? null;
  }
}
