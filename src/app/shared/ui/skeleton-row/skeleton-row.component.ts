import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="skeleton-row"
      [style.height.px]="heightPx()"
      [style.border-radius]="borderRadius()"
      aria-hidden="true"
    ></div>
  `,
  styles: [`
    :host { display: block; }
    .skeleton-row {
      width: 100%;
      height: 48px;
      border-radius: var(--radius-lg);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    :host-context(.dark) .skeleton-row {
      background: linear-gradient(90deg, var(--color-neutral-700) 25%, var(--color-neutral-600) 50%, var(--color-neutral-700) 75%);
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-row { animation: none; }
    }
  `],
})
export class SkeletonRowComponent {
  readonly heightPx = input<number>(48);
  readonly borderRadius = input<string>('var(--radius-lg)');
}
