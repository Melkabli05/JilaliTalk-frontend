import { Component, ChangeDetectionStrategy, input, model, signal } from '@angular/core';
import { LucideSearch, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-search-bar',
  imports: [LucideSearch, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block flex-1 min-w-0' },
  template: `
    <div
      class="flex items-center gap-2 h-11 lg:h-9 pr-2 pl-3 rounded-full
             bg-neutral-100 dark:bg-neutral-900
             border-[1.5px] border-neutral-200 dark:border-neutral-700
             shadow-[inset_0_1px_2px_rgb(0_0_0/4%)] dark:shadow-none
             transition-[background-color,border-color,box-shadow] duration-150
             motion-reduce:transition-none"
      [class]="focused()
        ? 'bg-white dark:bg-neutral-800 border-blue-400 shadow-[0_0_0_3px_rgb(59_130_246/12%)] dark:shadow-[0_0_0_3px_rgb(59_130_246/20%)]'
        : 'hover:border-neutral-300 dark:hover:border-neutral-600'"
    >
      <svg
        aria-hidden="true"
        lucideSearch
        [size]="14"
        class="shrink-0 pointer-events-none transition-colors duration-150 motion-reduce:transition-none"
        [class]="focused() ? 'text-blue-400 dark:text-blue-300' : 'text-neutral-500 dark:text-neutral-500'"
      ></svg>
      <input
        class="flex-1 min-w-0 border-0 bg-transparent text-neutral-900 dark:text-neutral-100 text-base lg:text-sm leading-none outline-none
               placeholder:text-neutral-500 dark:placeholder:text-neutral-500
               [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        type="search"
        inputmode="search"
        enterkeyhint="search"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="onInput($event)"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)"
        (keydown.escape)="clear()"
        [attr.aria-label]="placeholder()"
      />
      @if (value()) {
        <button
          type="button"
          class="flex items-center justify-center shrink-0 w-8 h-8 lg:w-[18px] lg:h-[18px] p-0 border-0 rounded-full
                 bg-neutral-400 dark:bg-neutral-600 text-white cursor-pointer
                 transition-[background-color,transform] duration-150 motion-reduce:transition-none
                 hover:bg-neutral-500 active:scale-90
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          (mousedown)="$event.preventDefault()"
          (click)="clear()"
          aria-label="Clear search"
        >
          <svg aria-hidden="true" lucideX [size]="10"></svg>
        </button>
      }
    </div>
  `,
})
export class SearchBarComponent {
  readonly placeholder = input<string>('Search rooms…');
  readonly value = model<string>('');

  protected readonly focused = signal(false);

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.value.set('');
  }
}
