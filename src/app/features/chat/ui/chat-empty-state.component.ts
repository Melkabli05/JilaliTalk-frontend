import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-chat-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent],
  template: `<app-empty-state [title]="title()" [body]="body()" />`,
})
export class ChatEmptyStateComponent {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
}