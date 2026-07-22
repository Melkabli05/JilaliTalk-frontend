import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-chat-gift-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `<p [class]="bubbleClass()">Gift ×{{ count() }}</p>`,
})
export class ChatGiftBubbleComponent {
  readonly count = input.required<number>();
  readonly isOutbound = input<boolean>(false);

  protected readonly bubbleClass = computed(() => {
    const base = 'm-0 py-2 px-3 rounded-2xl italic opacity-95 max-w-[min(75%,420px)] shadow-xs';
    return this.isOutbound()
      ? `${base} self-end rtl:self-start bg-blue-500 dark:bg-blue-600 text-white`
      : `${base} self-start rtl:self-end bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100`;
  });
}