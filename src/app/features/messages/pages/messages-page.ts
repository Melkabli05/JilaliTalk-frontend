import {
  Component,
  ChangeDetectionStrategy,
  inject,
  ElementRef,
  viewChild,
  effect,
  signal,
  computed,
} from '@angular/core';
import {
  LucideChevronLeft,
  LucideX,
  LucideInbox,
  LucideMessageCircle,
  LucideGift,
  LucideLock,
} from '@lucide/angular';
import { ImSocketService } from '@core/realtime/im-socket.service';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { relativeTime as formatRelativeTime } from '@shared/utils';
import { MessagesSearchComponent } from '../ui/search/messages-search';
import { MessagesStore } from '../store/messages.store';
import type { DmConversation, DmMessage } from '../models/dm.model';
import { isGroupStart, isGroupEnd, dateLabel, preview, fmtTime } from '../utils/dm-formatting.util';

@Component({
  selector: 'app-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessagesStore],
  imports: [
    AvatarComponent,
    MessagesSearchComponent,
    LucideChevronLeft,
    LucideX,
    LucideInbox,
    LucideMessageCircle,
    LucideGift,
    LucideLock,
  ],
  templateUrl: './messages-page.html',
  styleUrl: './messages-page.scss',
})
export class MessagesPageComponent {
  protected readonly store = inject(MessagesStore);
  protected readonly imSocket = inject(ImSocketService);

  protected readonly searchQuery = signal('');

  protected readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.store.conversations();
    if (!q) return all;
    return all.filter((c) => c.nickname.toLowerCase().includes(q) || c.userId.includes(q));
  });

  private readonly feedEl = viewChild<ElementRef<HTMLElement>>('feed');

  constructor() {
    effect(() => {
      const conv = this.store.selected();
      if (!conv) return;
      conv.messages.length;
      conv.isTyping; // also scroll when typing bubble appears
      const el = this.feedEl()?.nativeElement;
      if (el)
        Promise.resolve().then(() => {
          el.scrollTop = el.scrollHeight;
        });
    });
  }

  /** Delegates to pure helpers in utils/dm-formatting.util.ts so the Angular template
   *  can call them as class members — the formatting logic itself has no `this`
   *  dependency and lives outside the component per this feature's DDD-lite pass. */
  protected isGroupStart(messages: readonly DmMessage[], i: number): boolean {
    return isGroupStart(messages, i);
  }

  protected isGroupEnd(messages: readonly DmMessage[], i: number): boolean {
    return isGroupEnd(messages, i);
  }

  protected dateLabel(messages: readonly DmMessage[], i: number): string | null {
    return dateLabel(messages, i);
  }

  protected preview(conv: DmConversation): string {
    return preview(conv);
  }

  protected fmtTime(ts: number): string {
    return fmtTime(ts);
  }

  /** Delegates to the imported `formatRelativeTime` so the Angular template can call it as
   *  a class member. Aliased on import to avoid shadowing this method. */
  protected formatRelativeTime(ts: number): string {
    return formatRelativeTime(ts);
  }
}
