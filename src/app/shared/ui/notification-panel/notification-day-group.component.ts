import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { NotificationItemComponent } from './notification-item.component';
import type { AppNotification } from './notification.model';

@Component({
  selector: 'app-notification-day-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationItemComponent],
  template: `
    <section class="day-group" [attr.aria-label]="label()">
      <h3 class="mx-1 mt-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{{ label() }}</h3>
      @for (item of items(); track item.id) {
        <app-notification-item
          [notification]="item"
          (remove)="remove.emit($event)"
          (open)="open.emit($event)"
        />
      }
    </section>
  `,
})
export class NotificationDayGroupComponent {
  readonly label = input.required<string>();
  readonly items = input.required<readonly AppNotification[]>();
  readonly remove = output<string>();
  readonly open = output<AppNotification>();
}
