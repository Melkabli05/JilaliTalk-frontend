import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'app-modal',
  imports: [A11yModule, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-labelledby]': 'titleId',
    '(keydown.escape)': 'close()',
    class: 'block',
  },
  template: `
    <div
      class="modal-shell relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700
             rounded-[var(--_modal-radius,0.75rem)] overflow-hidden"
      cdkTrapFocusAutoCapture
    >
      @if (title()) {
        <header class="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div class="flex items-center gap-2 min-w-0">
            <h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100 m-0 whitespace-nowrap overflow-hidden text-ellipsis" [id]="titleId">{{ title() }}</h2>
            @if (count()) {
              <span class="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full
                           bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-200
                           text-xs font-semibold shrink-0">{{ count() }}</span>
            }
          </div>
          <button
            type="button"
            class="w-11 h-11 rounded-full border-0 bg-neutral-100 dark:bg-neutral-700
                   text-neutral-500 dark:text-neutral-300 cursor-pointer
                   [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
                   flex items-center justify-center shrink-0
                   transition-[background,color,transform] duration-150
                   hover:bg-neutral-200 hover:text-neutral-900 hover:rotate-90
                   dark:hover:bg-neutral-600 dark:hover:text-neutral-100
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            (click)="close()"
            aria-label="Close"
          >
            <svg aria-hidden="true" lucideX [size]="14" />
          </button>
        </header>
      }
      <div class="px-5 py-4" [class.p-0]="noPadding()">
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly ref = inject(DialogRef);

  readonly title = input<string>('');

  readonly count = input<number | null>(null);

  readonly noPadding = input(false);

  protected readonly titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;

  close(): void {
    this.ref.close();
  }
}
