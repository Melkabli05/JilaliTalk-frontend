import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { StageUserComponent } from '../../ui/stage-user';
import { StageUser } from '../../data/room-model';
import { sortByStageRole } from '../../ui/stage-sort.util';
import { LucideUserCircle } from '@lucide/angular';

@Component({
  selector: 'app-stage-grid',

  imports: [StageUserComponent, LucideUserCircle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="stage-header">
      <span class="stage-title">Stage</span>
      <span class="stage-count">{{ stageCount() }}</span>
    </header>
    <div class="stage-grid">
      @for (user of sortedStageUsers(); track user.userId) {
        <app-stage-user
          [user]="user"
          [speaking]="speakingUids().includes(user.userId)"
          (userClick)="userClick.emit($event)"
        />
      }
      @for (i of emptySlotRange(); track i) {
        <div class="empty-slot">
          <div class="empty-avatar">
            <svg aria-hidden="true" lucideUserCircle [size]="24"></svg>
          </div>
          <span class="empty-label">Empty</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        /* Stop iOS rubber-band from chaining past the stage scroll
           container. Matches the same rule on .comment-list and
           .audience-scroll so all three inner scrollers are
           contained. */
        overscroll-behavior: contain;

        --sg-header-border: var(--color-border);
        --sg-title: var(--color-text);
        --sg-count-bg: var(--color-neutral-100);
        --sg-count-fg: var(--color-text-secondary);
        --sg-empty-bg: var(--color-neutral-50);
        --sg-empty-border: var(--color-neutral-200);
        --sg-empty-fg: var(--color-neutral-300);
        --sg-empty-label: var(--color-text-muted);
      }
      :host-context(.dark) {
        --sg-header-border: var(--color-neutral-700);
        --sg-title: var(--color-neutral-200);
        --sg-count-bg: var(--color-neutral-700);
        --sg-count-fg: var(--color-neutral-400);
        --sg-empty-bg: var(--color-neutral-800);
        --sg-empty-border: var(--color-neutral-700);
        --sg-empty-fg: var(--color-neutral-600);
        --sg-empty-label: var(--color-neutral-500);
      }

      .stage-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--sg-header-border);
        flex-shrink: 0;
      }

      .stage-title {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--sg-title);
      }

      .stage-count {
        font-size: var(--text-xs);
        color: var(--sg-count-fg);
        padding: 1px 6px;
        border-radius: var(--radius-full);
        background: var(--sg-count-bg);
      }

      .stage-grid {
        display: grid;
        /* Mobile: 4 equal columns — predictable, readable tiles at any
           phone width. Desktop switches to auto-fill so wider rooms use
           the extra space naturally. */
        grid-template-columns: repeat(4, 1fr);
        justify-content: start;
        gap: var(--space-3);
        padding: var(--space-3);
        align-content: start;
        background-color: var(--color-card);
      }

      /* Desktop: responsive auto-fill, same as before the mobile-first rework —
         the room-page container this is nested in is already wide here, so a
         size-based column count (not a fixed 4) uses the space better across
         the full 8-slot stage. */
      @container room-page (min-width: 1024px) {
        .stage-grid {
          grid-template-columns: repeat(auto-fill, minmax(64px, 80px));
        }
      }

      .empty-slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-1);
        width: 100%;
      }

      .empty-avatar {
        width: 100%;
        /* Ceiling matching app-stage-user's avatar cap (--space-16 = 64px) — on
           desktop, repeat(4, 1fr) columns are far wider than on mobile, and
           without this the placeholder scales up with the column instead of
           just filling it. */
        max-width: var(--space-16);
        aspect-ratio: 1;
        border-radius: 50%;
        border: 2px dashed var(--sg-empty-border);
        background: var(--sg-empty-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--sg-empty-fg);
      }

      .empty-label {
        font-size: var(--text-2xs);
        color: var(--sg-empty-label);
      }
    `,
  ],
})
export class StageGridComponent {
  readonly users = input<readonly StageUser[]>([]);
  readonly maxStageUsers = input<number>(8);
  readonly speakingUids = input<readonly number[]>([]);
  readonly userClick = output<StageUser>();

  readonly sortedStageUsers = computed(() => sortByStageRole(this.users()));

  readonly stageCount = computed(() => this.users().length);

  readonly emptySlotCount = computed(() => {
    const max = this.maxStageUsers();
    const current = this.stageCount();
    return Math.max(0, max - current);
  });

  readonly emptySlotRange = computed(() =>
    Array.from({ length: this.emptySlotCount() }, (_, i) => i + 1),
  );
}
