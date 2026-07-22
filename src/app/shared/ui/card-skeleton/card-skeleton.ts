import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-card-skeleton',

  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @for (item of items; track $index) {
      <div
        class="flex flex-col gap-4 h-full box-border p-4 rounded-xl
               bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
               max-[640px]:grid max-[640px]:grid-cols-[1fr_auto] max-[640px]:items-center
               max-[640px]:[grid-template-areas:'header_header'_'host_members'_'tags_tags'_'actions_actions']
               max-[640px]:p-3 max-[640px]:gap-2"
        aria-hidden="true"
      >
        <div class="flex flex-col gap-1 [grid-area:header]">
          <div class="shimmer h-3.5 w-[85%] rounded-sm motion-reduce:animate-none motion-reduce:opacity-50"></div>
          <div class="shimmer h-[11px] w-[55%] rounded-sm motion-reduce:animate-none motion-reduce:opacity-50"></div>
        </div>

        <div class="flex items-center gap-2 [grid-area:host]">
          <div class="shimmer w-9 h-9 rounded-full shrink-0 motion-reduce:animate-none motion-reduce:opacity-50"></div>
          <div class="flex flex-col gap-1 flex-1">
            <div class="shimmer h-3 w-[70px] rounded-sm motion-reduce:animate-none motion-reduce:opacity-50"></div>
            <div class="shimmer h-2.5 w-6 rounded-sm motion-reduce:animate-none motion-reduce:opacity-50"></div>
          </div>
        </div>

        <div class="shimmer h-[18px] w-15 rounded-full [grid-area:tags] motion-reduce:animate-none motion-reduce:opacity-50"></div>

        <div class="flex items-center justify-between [grid-area:members] max-[640px]:justify-self-end">
          <div class="flex gap-0.5">
            <div class="shimmer w-6 h-6 rounded-full border-2 border-white dark:border-neutral-800 -ml-1 first:ml-0 motion-reduce:animate-none motion-reduce:opacity-50"></div>
            <div class="shimmer w-6 h-6 rounded-full border-2 border-white dark:border-neutral-800 -ml-1 motion-reduce:animate-none motion-reduce:opacity-50"></div>
            <div class="shimmer w-6 h-6 rounded-full border-2 border-white dark:border-neutral-800 -ml-1 motion-reduce:animate-none motion-reduce:opacity-50"></div>
          </div>
          <div class="shimmer h-[11px] w-9 rounded-sm motion-reduce:animate-none motion-reduce:opacity-50"></div>
        </div>

        <div class="flex justify-between mt-auto [grid-area:actions] max-[640px]:mt-0">
          <div class="shimmer h-[30px] w-18 rounded-md motion-reduce:animate-none motion-reduce:opacity-50"></div>
          <div class="shimmer h-[30px] w-20 rounded-md motion-reduce:animate-none motion-reduce:opacity-50"></div>
        </div>
      </div>
    }
  `,
  /** Shared shimmer-sweep color/animation hook (10 call sites above) — no Tailwind utility
   *  for the moving background-position + background-size 200% animation, so this stays a
   *  single reusable scoped class instead of repeating the gradient in every utility list. */
  styles: [`
    .shimmer {
      background: linear-gradient(90deg, #e5e5e5 25%, #f5f5f5 50%, #e5e5e5 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    :host-context(.dark) .shimmer {
      background: linear-gradient(90deg, #404040 25%, #262626 50%, #404040 75%);
      background-size: 200% 100%;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class CardSkeletonComponent {
  readonly count = input<number>(6);

  get items() {
    return Array(this.count()).fill(null);
  }
}
