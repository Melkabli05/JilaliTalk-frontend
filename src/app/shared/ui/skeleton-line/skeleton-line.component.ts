import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="skeleton-line block w-1/2 h-3.5 rounded-sm motion-reduce:animate-none"
      [class.is-wide]="width() === 'wide'"
      [class.is-narrow]="width() === 'narrow'"
      [style.height.px]="heightPx()"
      [style.width.%]="widthPct()"
      aria-hidden="true"
    ></span>
  `,
  /** Same irreducible shimmer sweep as skeleton-row.component.ts — no Tailwind utility for
   *  the moving background-position + background-size 200% animation. */
  styles: [`
    :host { display: block; }
    .skeleton-line {
      background: linear-gradient(90deg, #e5e5e5 25%, #f5f5f5 50%, #e5e5e5 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    :host-context(.dark) .skeleton-line {
      background: linear-gradient(90deg, #404040 25%, #525252 50%, #404040 75%);
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
