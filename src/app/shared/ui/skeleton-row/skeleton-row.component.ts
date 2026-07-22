import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="skeleton-row w-full h-12 motion-reduce:animate-none"
      [style.height.px]="heightPx()"
      [style.border-radius]="borderRadius()"
      aria-hidden="true"
    ></div>
  `,
  /** Remaining custom CSS: the shimmer sweep (moving background-position + background-size
   *  200%) has no Tailwind utility equivalent. Colors are Tailwind's own neutral-100/200/
   *  600/700 hex values used directly (bg-linear-to-r can't express the two-position
   *  animation Tailwind's gradient utilities target a static gradient, not a sweep). */
  styles: [`
    :host { display: block; }
    .skeleton-row {
      border-radius: 0.75rem;
      background: linear-gradient(90deg, #e5e5e5 25%, #f5f5f5 50%, #e5e5e5 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    :host-context(.dark) .skeleton-row {
      background: linear-gradient(90deg, #404040 25%, #525252 50%, #404040 75%);
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
  readonly borderRadius = input<string>('0.75rem');
}
