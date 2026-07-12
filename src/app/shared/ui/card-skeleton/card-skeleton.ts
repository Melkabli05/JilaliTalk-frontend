import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-card-skeleton',

  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (item of items; track $index) {
      <div class="skeleton-card" aria-hidden="true">
                <div class="skeleton-section">
          <div class="skeleton-title"></div>
          <div class="skeleton-topic"></div>
        </div>

                <div class="skeleton-host">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-host-info">
            <div class="skeleton-name"></div>
            <div class="skeleton-flag"></div>
          </div>
        </div>

                <div class="skeleton-tag"></div>

                <div class="skeleton-members">
          <div class="skeleton-avatars">
            <div class="skeleton-avatar-sm"></div>
            <div class="skeleton-avatar-sm"></div>
            <div class="skeleton-avatar-sm"></div>
          </div>
          <div class="skeleton-count"></div>
        </div>

                <div class="skeleton-actions">
          <div class="skeleton-btn"></div>
          <div class="skeleton-btn-sm"></div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }

    .skeleton-card {
      background-color: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      height: 100%;
      box-sizing: border-box;
    }

    @media (width <= 640px) {
      .skeleton-card {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        grid-template-areas:
          "header header"
          "host members"
          "tags tags"
          "actions actions";
        padding: var(--space-3);
        gap: var(--space-2);
      }
      .skeleton-section { grid-area: header; }
      .skeleton-host { grid-area: host; }
      .skeleton-members { grid-area: members; justify-self: end; }
      .skeleton-tag { grid-area: tags; }
      .skeleton-actions { grid-area: actions; margin-top: 0; }
    }

        .skeleton-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .skeleton-title {
      height: 14px;
      width: 85%;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-topic {
      height: 11px;
      width: 55%;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

        .skeleton-host {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .skeleton-avatar {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-full);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      flex-shrink: 0;
    }

    .skeleton-host-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .skeleton-name {
      height: 12px;
      width: 70px;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-flag {
      height: 10px;
      width: 24px;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

        .skeleton-tag {
      height: 18px;
      width: 60px;
      border-radius: var(--radius-full);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

        .skeleton-members {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .skeleton-avatars {
      display: flex;
      gap: 2px;
    }

    .skeleton-avatar-sm {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-full);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border: 2px solid var(--color-card);
      margin-left: -4px;

      &:first-child { margin-left: 0; }
    }

    .skeleton-count {
      height: 11px;
      width: 36px;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

        .skeleton-actions {
      display: flex;
      justify-content: space-between;
      margin-top: auto;
    }

    .skeleton-btn {
      height: 30px;
      width: 72px;
      border-radius: var(--radius-md);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-btn-sm {
      height: 30px;
      width: 80px;
      border-radius: var(--radius-md);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

        :host-context(.dark) .skeleton-card {
      background-color: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }

    :host-context(.dark) .skeleton-title,
    :host-context(.dark) .skeleton-topic,
    :host-context(.dark) .skeleton-avatar,
    :host-context(.dark) .skeleton-name,
    :host-context(.dark) .skeleton-flag,
    :host-context(.dark) .skeleton-tag,
    :host-context(.dark) .skeleton-avatar-sm,
    :host-context(.dark) .skeleton-count,
    :host-context(.dark) .skeleton-btn,
    :host-context(.dark) .skeleton-btn-sm {
      background: linear-gradient(90deg, var(--color-neutral-700) 25%, var(--color-neutral-800) 50%, var(--color-neutral-700) 75%);
      background-size: 200% 100%;
    }

    :host-context(.dark) .skeleton-avatar-sm {
      border-color: var(--color-neutral-800);
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton-title, .skeleton-topic, .skeleton-avatar,
      .skeleton-name, .skeleton-flag, .skeleton-tag,
      .skeleton-avatar-sm, .skeleton-count,
      .skeleton-btn, .skeleton-btn-sm {
        animation: none;
        opacity: 0.5;
      }
    }
  `]
})
export class CardSkeletonComponent {
  readonly count = input<number>(6);

  get items() {
    return Array(this.count()).fill(null);
  }
}
