import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import type { NotificationFilter } from './notification.model';

interface TabDef {
  readonly value: NotificationFilter;
  readonly label: string;
}

const TABS: readonly TabDef[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

@Component({
  selector: 'app-notification-filter-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex gap-1 px-4 py-2 overflow-x-auto overscroll-x-contain border-b border-neutral-200 dark:border-neutral-700
             [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Filter notifications"
    >
      @for (tab of tabs; track tab.value) {
        <button
          type="button"
          role="tab"
          class="shrink-0 inline-flex items-center gap-1 py-1.5 px-2.5 rounded-full border-0 bg-transparent
                 text-neutral-600 dark:text-neutral-300 text-xs font-medium cursor-pointer
                 transition-colors duration-150
                 hover:bg-neutral-100 hover:text-neutral-900
                 dark:hover:bg-neutral-700 dark:hover:text-neutral-100
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                 [&.active]:bg-blue-500 [&.active]:text-white"
          [class.active]="active() === tab.value"
          [attr.aria-selected]="active() === tab.value"
          (click)="filterChange.emit(tab.value)"
        >
          {{ tab.label }}
          @if (counts()[tab.value] > 0) {
            <span class="text-[10px] font-bold opacity-80">{{ counts()[tab.value] }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class NotificationFilterTabsComponent {
  readonly active = input.required<NotificationFilter>();
  readonly counts = input.required<Record<NotificationFilter, number>>();
  readonly filterChange = output<NotificationFilter>();

  protected readonly tabs = TABS;
}
