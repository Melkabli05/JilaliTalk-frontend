import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="skeleton-line"
      [class.is-wide]="width() === 'wide'"
      [class.is-narrow]="width() === 'narrow'"
      [style.height.px]="heightPx()"
      [style.width.%]="widthPct()"
      aria-hidden="true"
    ></span>
  `,
  styles: [`
    :host { display: block; }
    .skeleton-line {
      display: block;
      width: 50%;
      height: 14px;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    :host-context(.dark) .skeleton-line {
      background: linear-gradient(90deg, var(--color-neutral-700) 25%, var(--color-neutral-600) 50%, var(--color-neutral-700) 75%);
    }
    .skeleton-line.is-wide { width: 80%; height: 18px; }
    .skeleton-line.is-narrow { width: 30%; }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-line { animation: none; }
    }
  `],
})
export class SkeletonLineComponent {
  readonly width = input<'narrow' | 'normal' | 'wide'>('normal');
  readonly heightPx = input<number | null>(null);
  readonly widthPct = input<number | null>(null);
}
