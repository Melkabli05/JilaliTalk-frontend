import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { NotificationItemComponent } from './notification-item.component';
import type { AppNotification } from './notification.model';

@Component({
  selector: 'app-notification-day-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationItemComponent],
  template: `
    <section class="day-group" [attr.aria-label]="label()">
      <h3 class="day-group-label">{{ label() }}</h3>
      @for (item of items(); track item.id) {
        <app-notification-item
          [notification]="item"
          (remove)="remove.emit($event)"
          (open)="open.emit($event)"
        />
      }
    </section>
  `,
  styles: [`
    .day-group-label {
      margin: var(--space-2) var(--space-1) 4px;
      font-size: 11px;
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: var(--letter-spacing-wide);
      color: var(--color-text-tertiary);
    }
  `],
})
export class NotificationDayGroupComponent {
  readonly label = input.required<string>();
  readonly items = input.required<readonly AppNotification[]>();
  readonly remove = output<string>();
  readonly open = output<AppNotification>();
}
