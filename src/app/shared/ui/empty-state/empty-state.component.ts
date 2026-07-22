import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideInbox } from '@lucide/angular';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideInbox],
  host: { class: 'block h-full' },
  template: `
    <div
      class="flex flex-col items-center justify-center gap-2 h-full text-center text-neutral-500 box-border
             animate-[emptyIn_320ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none"
      [class]="compact() ? 'px-3 py-5' : 'px-4 py-8'"
    >
      <div
        class="rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center
               animate-[iconFloat_4s_ease-in-out_infinite] motion-reduce:animate-none"
        [class]="compact() ? 'w-12 h-12' : 'w-16 h-16'"
        aria-hidden="true"
      >
        <ng-content select="[empty-state-icon]">
          <svg lucideInbox [size]="iconSize()"></svg>
        </ng-content>
      </div>
      <p class="m-0 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ title() }}</p>
      @if (body()) {
        <p class="m-0 text-xs max-w-[min(280px,80vw)]">{{ body() }}</p>
      }
      <ng-content select="[empty-state-actions]" />
    </div>
  `,
  /** Custom keyframes (fade/slide-in, gentle icon float) — genuine motion design, no
   *  Tailwind built-in equivalent. Referenced from the template via arbitrary
   *  animate-[name_duration_...] utilities; @keyframes names resolve globally regardless
   *  of Angular's Emulated encapsulation (only selectors are scoped, not at-rule names). */
  styles: [`
    @keyframes emptyIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes iconFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
  `],
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly body = input<string>('');
  readonly iconSize = input<number>(28);
  readonly compact = input<boolean>(false);
}
