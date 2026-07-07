import { Component, ChangeDetectionStrategy, input, output, computed, signal, viewChild, ElementRef } from '@angular/core';
import { StageUser } from '../models/room-model';
import { sortByStageRole } from './stage-sort.util';
import { LucideUsers, LucideVideo, LucideMaximize2, LucideMinimize2 } from '@lucide/angular';
import { VideoStageUserComponent, PlayableVideoTrack } from './video-stage-user';

@Component({
  selector: 'app-video-stage-grid',
  imports: [VideoStageUserComponent, LucideUsers, LucideVideo, LucideMaximize2, LucideMinimize2],
  host: {
    '[class.fullscreen]': 'fullscreen()',
    '(document:fullscreenchange)': 'onFullscreenChange()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stage-card" #stageCardRef>
      <header class="stage-header">
        <div class="header-left">
          <svg aria-hidden="true" lucideVideo size="14" class="header-icon"></svg>
          <h3 class="header-title">Live Stage</h3>
        </div>
        <div class="header-right">
          @if (stageCount() > 0) {
            <span class="stage-count">{{ stageCount() }}/{{ maxStageSize() }}</span>
          }
          <button
            class="fullscreen-btn"
            type="button"
            (click)="toggleFullscreen()"
            [attr.aria-label]="fullscreen() ? 'Exit fullscreen' : 'Fullscreen'"
          >
            @if (fullscreen()) {
              <svg aria-hidden="true" lucideMinimize2 [size]="13" />
            } @else {
              <svg aria-hidden="true" lucideMaximize2 [size]="13" />
            }
          </button>
        </div>
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

      /* Theming tokens — dark mode overrides below */
      :host {
        --vsg-card-bg: var(--color-card);
        --vsg-card-border: var(--color-border);
        --vsg-header-bg: var(--color-neutral-50);
        --vsg-header-border: var(--color-border);
        --vsg-text: var(--color-text);
        --vsg-text-muted: var(--color-text-muted);
        --vsg-chip-bg: var(--color-neutral-100);
        --vsg-icon: var(--color-primary-500);
        --vsg-icon-hover-bg: var(--color-neutral-100);
        --vsg-icon-hover-fg: var(--color-text);
        --vsg-scroll: var(--color-neutral-200);
      }
      :host-context(.dark) {
        --vsg-card-bg: var(--color-card);
        --vsg-card-border: var(--color-border);
        --vsg-header-bg: var(--color-neutral-800);
        --vsg-header-border: var(--color-neutral-700);
        --vsg-text: var(--color-neutral-100);
        --vsg-text-muted: var(--color-neutral-400);
        --vsg-chip-bg: var(--color-neutral-700);
        --vsg-icon: var(--color-primary-400);
        --vsg-icon-hover-bg: var(--color-neutral-700);
        --vsg-icon-hover-fg: var(--color-neutral-100);
        --vsg-scroll: var(--color-neutral-600);
      }

      .stage-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        border: 1px solid var(--vsg-card-border);
        background: var(--vsg-card-bg);
        overflow: hidden;
      }

      .stage-card:fullscreen {
        border: none;
        background: var(--color-black);
        padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
      }

      .stage-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--vsg-header-border);
        background: var(--vsg-header-bg);
        flex-shrink: 0;
      }

      .header-left,
      .header-right {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .fullscreen-btn {
        width: var(--icon-btn-size);
        height: var(--icon-btn-size);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-sm);
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-muted);
      }
      .fullscreen-btn:hover {
        background: var(--vsg-icon-hover-bg);
        color: var(--vsg-icon-hover-fg);
      }
      .fullscreen-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }

      .header-icon { color: var(--vsg-icon); }
      .header-title {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--vsg-text);
        margin: 0;
      }

      .stage-count {
        font-size: var(--text-xs);
        color: var(--vsg-text-muted);
        background: var(--vsg-chip-bg);
        padding: 1px 6px;
        border-radius: var(--radius-full);
      }

      .stage-grid {
        display: grid;
        gap: var(--space-3);
        padding: var(--space-3);
        overflow: hidden;
        height: 100%;
        /* baseline: 2 columns. 1 speaker is naturally single-column because
           there's only one item; 3 speakers need three columns. */
        grid-template-columns: repeat(2, 1fr);
      }
      .stage-grid[data-count='3'] {
        grid-template-columns: repeat(3, 1fr);
      }
      .stage-grid[data-count='4'] {
        grid-template-columns: repeat(2, 1fr);
      }

      .stage-grid::-webkit-scrollbar { width: 6px; }
      .stage-grid::-webkit-scrollbar-thumb {
        background: var(--vsg-scroll);
        border-radius: var(--radius-full);
      }
      .stage-grid::-webkit-scrollbar-track { background: transparent; }

      .stage-empty {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        color: var(--vsg-text-muted);
      }
      .empty-icon { opacity: 0.4; }
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

  private readonly stageCardRef = viewChild<ElementRef<HTMLDivElement>>('stageCardRef');
  readonly fullscreen = signal(false);

  videoTrackForUser(uid: number): PlayableVideoTrack | null {
    return this.videoTracks().get(uid) ?? null;
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const el = this.stageCardRef()?.nativeElement;
    void el?.requestFullscreen().catch(() => {});
  }

  onFullscreenChange(): void {
    this.fullscreen.set(document.fullscreenElement === this.stageCardRef()?.nativeElement);
  }
}
