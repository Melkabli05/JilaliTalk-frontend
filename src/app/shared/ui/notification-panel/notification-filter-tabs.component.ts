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
    <div class="filter-tabs" role="tablist" aria-label="Filter notifications">
      @for (tab of tabs; track tab.value) {
        <button
          type="button"
          role="tab"
          class="filter-tab"
          [class.active]="active() === tab.value"
          [attr.aria-selected]="active() === tab.value"
          (click)="filterChange.emit(tab.value)"
        >
          {{ tab.label }}
          @if (counts()[tab.value] > 0) {
            <span class="tab-count">{{ counts()[tab.value] }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [`
    .filter-tabs {
      display: flex;
      gap: var(--space-1);
      padding: var(--space-2) var(--space-4);
      overflow-x: auto;
      overscroll-behavior-x: contain;
      border-bottom: 1px solid var(--color-border);
      scrollbar-width: none;
    }
    .filter-tabs::-webkit-scrollbar { display: none; }

    .filter-tab {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border-radius: var(--radius-full);
      border: none;
      background: transparent;
      color: var(--color-text-secondary);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .filter-tab:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .filter-tab:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .filter-tab.active { background: var(--color-primary-500); color: var(--color-on-color); }
    :host-context(.dark) .filter-tab:hover { background: var(--color-neutral-700); }

    .tab-count { font-size: 10px; font-weight: var(--font-bold); opacity: 0.8; }
  `],
})
export class NotificationFilterTabsComponent {
  readonly active = input.required<NotificationFilter>();
  readonly counts = input.required<Record<NotificationFilter, number>>();
  readonly filterChange = output<NotificationFilter>();

  protected readonly tabs = TABS;
}
