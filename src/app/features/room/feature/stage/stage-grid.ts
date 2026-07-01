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
      }

      .stage-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .stage-title {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text);
      }

      :host-context(.dark) .stage-title {
        color: var(--color-neutral-200);
      }

      .stage-count {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        padding: 1px 6px;
        border-radius: var(--radius-full);
        background: var(--color-neutral-100);
      }

      :host-context(.dark) .stage-count {
        background: var(--color-neutral-700);
        color: var(--color-neutral-400);
      }

      .stage-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(64px, 80px));
        justify-content: start;
        gap: var(--space-2) var(--space-7);
        padding: var(--space-3);
        align-content: start;
        background-color: var(--color-card);
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
        aspect-ratio: 1;
        border-radius: 50%;
        border: 2px dashed var(--color-neutral-200);
        background: var(--color-neutral-50);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-neutral-300);
      }
      :host-context(.dark) .empty-avatar {
        background: var(--color-neutral-800);
        border-color: var(--color-neutral-700);
        color: var(--color-neutral-600);
      }

      .empty-label {
        font-size: var(--text-2xs);
        color: var(--color-text-muted);
      }

      :host-context(.dark) .empty-label {
        color: var(--color-neutral-500);
      }

      :host-context(.dark) .stage-header {
        border-color: var(--color-neutral-700);
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
