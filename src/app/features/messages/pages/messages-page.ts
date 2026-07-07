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
  template: `
    <div class="shell">
      <!-- ══════════════ Sidebar ══════════════ -->
      <aside class="sidebar" [class.hidden]="store.selected()">
        <header class="sidebar-header">
          <h1 class="sidebar-title">Messages</h1>
          <span
            class="conn-dot"
            [class]="imSocket.status()"
            [title]="imSocket.status()"
            aria-hidden="true"
          ></span>
        </header>

        <div class="search-wrap">
          <app-messages-search [(value)]="searchQuery" />
        </div>

        <!-- conversation count hint -->
        @if (store.conversations().length > 0) {
          <div class="conv-count">
            {{ store.conversations().length }}
            {{ store.conversations().length === 1 ? 'conversation' : 'conversations' }}
          </div>
        }

        @if (filteredConversations().length === 0) {
          <div class="empty">
            <div class="empty-icon">
              <svg aria-hidden="true" lucideInbox [size]="28"></svg>
            </div>
            <p class="empty-title">
              @if (searchQuery()) {
                No results
              } @else {
                No messages yet
              }
            </p>
            <p class="empty-body">
              @if (searchQuery()) {
                Nothing matches "{{ searchQuery() }}"
              } @else {
                Direct messages will appear here as they arrive in real time.
              }
            </p>
          </div>
        } @else {
          <ul role="listbox" aria-label="Conversations">
            @for (conv of filteredConversations(); track conv.userId) {
              <li
                role="option"
                [attr.aria-selected]="store.selectedId() === conv.userId"
                [class.active]="store.selectedId() === conv.userId"
                [class.unread]="conv.unread > 0"
                (click)="store.select(conv.userId)"
                tabindex="0"
                (keydown.enter)="store.select(conv.userId)"
              >
                <app-avatar
                  [alt]="conv.nickname"
                  size="md"
                  [ringColor]="
                    store.selectedId() === conv.userId ? 'var(--color-primary-500)' : null
                  "
                />
                <div class="row-body">
                  <span class="row-name">{{ conv.nickname }}</span>
                  <time class="row-ts" [attr.datetime]="conv.lastTs">
                    {{ formatRelativeTime(conv.lastTs) }}
                  </time>
                  @if (conv.isTyping) {
                    <span class="row-preview typing-preview" aria-label="typing">
                      <span class="typing-dots" aria-hidden="true">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                      </span>
                      <span class="typing-label">typing…</span>
                    </span>
                  } @else {
                    <span class="row-preview">{{ preview(conv) }}</span>
                  }
                  @if (conv.unread > 0) {
                    <span class="unread-badge" [attr.aria-label]="conv.unread + ' unread'">{{
                      conv.unread > 99 ? '99+' : conv.unread
                    }}</span>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </aside>

      <!-- ══════════════ Thread ══════════════ -->
      <main class="thread" [class.open]="store.selected()">
        @if (store.selected(); as conv) {
          <!-- mobile back bar -->
          <div class="mobile-bar">
            <button class="back-btn" (click)="store.back()" aria-label="Back to conversations">
              <svg aria-hidden="true" lucideChevronLeft [size]="18"></svg>
            </button>
            <div class="mobile-bar-identity">
              <app-avatar [alt]="conv.nickname" size="xs" />
              <span class="mobile-bar-name">{{ conv.nickname }}</span>
            </div>
            @if (conv.isTyping) {
              <span class="typing-dots" aria-label="typing" aria-hidden="true">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </span>
            }
          </div>

          <!-- messages -->
          <div class="feed" #feed>
            @for (msg of conv.messages; track msg.id; let i = $index) {
              @if (dateLabel(conv.messages, i); as label) {
                <div class="date-pill" role="separator">{{ label }}</div>
              }

              <div
                class="msg"
                [class.tail]="isGroupEnd(conv.messages, i)"
                [class.first]="isGroupStart(conv.messages, i)"
              >
                <!-- avatar shown only on group start -->
                @if (isGroupStart(conv.messages, i)) {
                  <app-avatar [alt]="conv.nickname" size="xs" class="msg-avatar" />
                } @else {
                  <span class="msg-avatar-gap"></span>
                }

                <div class="bubble">
                  @switch (msg.type) {
                    @case ('text') {
                      <p>{{ msg.text }}</p>
                    }
                    @case ('image') {
                      <img [src]="msg.imageUrl" alt="Photo" loading="lazy" />
                    }
                    @case ('gift') {
                      <span class="bubble-meta">
                        <svg aria-hidden="true" lucideGift [size]="13"></svg>
                        Gift &times;{{ msg.count ?? 1 }}
                      </span>
                    }
                    @case ('introduction') {
                      <span class="bubble-meta">
                        <svg aria-hidden="true" lucideMessageCircle [size]="13"></svg>
                        Introduction
                      </span>
                    }
                  }
                  @if (isGroupEnd(conv.messages, i)) {
                    <time class="bubble-time">{{ fmtTime(msg.ts) }}</time>
                  }
                </div>
              </div>
            }

            <!-- live typing bubble -->
            @if (conv.isTyping) {
              <div class="msg tail first typing-row">
                <app-avatar [alt]="conv.nickname" size="xs" class="msg-avatar" />
                <div class="bubble typing-bubble">
                  <span class="typing-dots" aria-label="typing">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                  </span>
                </div>
              </div>
            }
          </div>

          <!-- compose -->
          <div class="compose">
            <div class="compose-field" role="note" aria-label="Replies not available yet">
              <svg
                aria-hidden="true"
                lucideMessageCircle
                [size]="15"
                class="compose-msg-icon"
              ></svg>
              <span class="compose-placeholder">Reply…</span>
              <div class="compose-lock">
                <svg aria-hidden="true" lucideLock [size]="12"></svg>
                <span>Soon</span>
              </div>
            </div>
          </div>
        } @else {
          <!-- no conversation selected -->
          <div class="no-selection">
            <div class="no-selection-icon">
              <svg aria-hidden="true" lucideMessageCircle [size]="40"></svg>
            </div>
            <p class="no-selection-title">Your messages</p>
            <span class="no-selection-body">
              Pick a conversation from the left to start reading
            </span>
          </div>
        }
      </main>
    </div>
  `,
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
