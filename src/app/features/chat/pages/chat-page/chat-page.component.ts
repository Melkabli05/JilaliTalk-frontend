import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { from, of } from 'rxjs';
import {
  LucideChevronLeft,
  LucidePlus,
  LucideSearch,
  LucideX,
} from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { UserInfoModalComponent, UserInfoModalData } from '@shared/ui/user-info-modal';
import { UserPickerSheetComponent } from '@shared/ui/user-picker-sheet/user-picker-sheet';
import { ImagePickerModalComponent, type ImagePickerResult } from '@shared/ui/image-picker-modal/image-picker-modal.component';
import { KeyboardInsetService } from '@core/services/keyboard-inset.service';
import { injectIsMobileViewport, relativeTime } from '@shared/utils';
import type { IntroductionPayload } from '@core/realtime/dm-send-payload.model';
import { ChatStore } from '../../store/chat.store';
import { CHAT_PROFILE_DIRECTORY } from '../../store/chat.tokens';
import type { ChatProfileDirectory } from '../../data-access/chat.port';
import type { ChatConversation, ChatMessage, ChatUserPickerTab, ChatUserSummary } from '../../models/chat-message.model';
import { asNumericPeerId } from '../../utils/chat-ids';
import { filterConversationsByQuery } from '../../utils/chat-sort.util';
import { dayLabel } from '../../utils/chat-day-label.util';
import { chatMessageAriaLabel } from '../../utils/chat-preview.util';
import { createTypingBroadcaster } from '../../utils/chat-typing-debouncer';
import { ChatTextBubbleComponent } from '../../ui/chat-text-bubble.component';
import { ChatImageBubbleComponent } from '../../ui/chat-image-bubble.component';
import { ChatGiftBubbleComponent } from '../../ui/chat-gift-bubble.component';
import { ChatIntroductionBubbleComponent } from '../../ui/chat-introduction-bubble.component';
import { ChatRoomShareCardComponent } from '../../ui/chat-room-share-card.component';
import { ChatDeliveryMarkComponent } from '../../ui/chat-delivery-mark.component';
import { ChatComposerComponent, type ComposerAction } from '../../ui/chat-composer.component';
import { ChatConversationRowComponent } from '../../ui/chat-conversation-row.component';
import { ChatConnectionPillComponent } from '../../ui/chat-connection-pill.component';
import { ChatEmptyStateComponent } from '../../ui/chat-empty-state.component';

const TYPING_STOP_DELAY_MS = 3000;
/** How close to the bottom the user must be (in px) before an inbound message or conversation
 *  switch will autoscroll them. Larger = stickier (always scroll), smaller = more forgiving
 *  (let the user stay at their scrolled position while older messages load). */
const AUTOSCROLL_THRESHOLD_PX = 80;
const FOLLOWING_LIMIT = 50;
const FOLLOWERS_LIMIT = 50;

const TOUCH = '[touch-action:manipulation] [-webkit-tap-highlight-color:transparent]';
/** Both panels share the same slide transition; whichever panel is currently hidden also
 *  gets a `visibility` delay so it stops intercepting clicks/focus only once the slide-out
 *  animation finishes, not the instant the transform starts. */
const PANEL_TRANSITION_PLAIN = "max-md:[transition:transform_280ms_cubic-bezier(0.32,0.72,0,1)]";
const PANEL_TRANSITION_DELAYED_VISIBILITY =
  "max-md:[transition:transform_280ms_cubic-bezier(0.32,0.72,0,1),visibility_0ms_280ms]";

@Component({
  selector: 'app-chat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ChatStore],
  host: {
    class: 'block h-full',
    '[style.--kb-inset.px]': 'keyboardInsetPx()',
  },
  imports: [
    AvatarComponent,
    ChatTextBubbleComponent,
    ChatImageBubbleComponent,
    ChatGiftBubbleComponent,
    ChatIntroductionBubbleComponent,
    ChatRoomShareCardComponent,
    ChatDeliveryMarkComponent,
    ChatComposerComponent,
    ChatConversationRowComponent,
    ChatConnectionPillComponent,
    UserPickerSheetComponent,
    ChatEmptyStateComponent,
    LucideChevronLeft,
    LucidePlus,
    LucideSearch,
    LucideX,
  ],
  template: `
    <div class="flex h-[calc(100%-var(--kb-inset,0px))] overflow-hidden relative" [inert]="pickerOpen() !== null">
      <aside [class]="sidebarClass()">
        <header
          class="flex items-center justify-between p-4 shrink-0 border-b border-neutral-200 dark:border-neutral-700
                 sticky top-0 z-[2] bg-white/92 dark:bg-neutral-900/92 backdrop-blur-md backdrop-saturate-[1.8]"
        >
          <h1 class="m-0 text-xl font-bold text-neutral-900 dark:text-neutral-100">Chat</h1>
          <div class="inline-flex items-center gap-2">
            <app-chat-connection-pill [status]="store.connectionStatus()" (retry)="onRetry()" />
            <button
              type="button"
              class="w-8 h-8 max-md:w-11 max-md:h-11 inline-flex items-center justify-center border-0
                     bg-blue-500 text-white rounded-full cursor-pointer {{ TOUCH }}
                     hover:bg-blue-600
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              (click)="togglePicker('newConversation')"
              [attr.aria-label]="pickerOpen() === 'newConversation' ? 'Close new chat panel' : 'New chat'"
              [attr.aria-expanded]="pickerOpen() === 'newConversation'"
              aria-controls="chat-user-picker"
            >
              <svg aria-hidden="true" lucidePlus [size]="16"></svg>
            </button>
          </div>
        </header>

        <div class="relative py-2 px-3 shrink-0">
          <svg aria-hidden="true" lucideSearch [size]="14" class="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"></svg>
          <input
            #searchInput
            type="search"
            class="w-full h-9 max-md:h-11 px-9 border border-neutral-200 dark:border-neutral-700 rounded-full
                   bg-neutral-100 dark:bg-neutral-800 text-[max(16px,0.875rem)] text-neutral-900 dark:text-neutral-100 outline-none
                   focus:bg-white dark:focus:bg-neutral-900 focus:border-blue-400 focus:shadow-[0_0_0_3px_rgb(59_130_246/12%)]"
            placeholder="Search conversations"
            aria-label="Search conversations"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
          />
          @if (searchQuery()) {
            <button
              type="button"
              class="absolute right-4 max-md:right-2 top-1/2 -translate-y-1/2 w-7 h-7 max-md:w-11 max-md:h-11
                     inline-flex items-center justify-center border-0 bg-transparent text-neutral-500 rounded-full cursor-pointer {{ TOUCH }}
                     hover:bg-neutral-200 hover:text-neutral-900
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              aria-label="Clear search"
              (click)="clearSearch(searchInput)"
            >
              <svg aria-hidden="true" lucideX [size]="14"></svg>
            </button>
          }
        </div>

        @if (filteredConversations().length === 0) {
          <app-chat-empty-state
            [title]="searchQuery() ? 'No results' : 'No chats yet'"
            [body]="searchQuery() ? ('Nothing matches \\'' + searchQuery() + '\\'') : 'Start a new chat from the + button.'"
          />
        } @else {
          <ul
            class="flex-1 overflow-y-auto list-none m-0 pt-1 px-2 pb-2"
            role="listbox"
            aria-label="Conversations"
            (keydown)="onConversationsKeydown($event)"
            tabindex="0"
          >
            @for (conv of filteredConversations(); track conv.peerUserId) {
              <li class="mb-0.5 {{ TOUCH }}" role="option" [attr.aria-selected]="store.selectedPeerId() === conv.peerUserId">
                <app-chat-conversation-row
                  [conversation]="conv"
                  [active]="store.selectedPeerId() === conv.peerUserId"
                  [avatarSize]="isMobileViewport() ? 'lg' : 'md'"
                  [formatTime]="formatTime"
                  (select)="onSelect(conv.peerUserId)"
                />
              </li>
            }
          </ul>
        }
      </aside>

      <main [class]="threadClass()">
        @if (store.selectedConversation(); as conv) {
          <header
            class="flex items-center gap-2 py-2 px-3 shrink-0 border-b border-neutral-200 dark:border-neutral-700
                   bg-white/92 dark:bg-neutral-900/92 backdrop-blur-md backdrop-saturate-[1.8]"
          >
            <button
              type="button"
              class="w-8 h-8 max-md:w-11 max-md:h-11 inline-flex items-center justify-center border-0 bg-transparent
                     text-blue-500 rounded-md cursor-pointer shrink-0 {{ TOUCH }}
                     hover:bg-neutral-100 dark:hover:bg-neutral-800
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              (click)="store.deselect()"
              aria-label="Back to conversations"
            >
              <svg aria-hidden="true" lucideChevronLeft [size]="18"></svg>
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 border-0 bg-transparent cursor-pointer flex-1 max-md:min-h-11
                     text-left py-1 px-1.5 rounded-md text-neutral-900 dark:text-neutral-100 min-w-0 {{ TOUCH }}
                     hover:bg-neutral-100 dark:hover:bg-neutral-800
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              (click)="onViewProfile(conv.peerUserId, conv.nickname, conv.headUrl)"
              [attr.aria-label]="'View ' + conv.nickname + '’s profile'"
            >
              <app-avatar [src]="conv.headUrl ?? ''" [initials]="conv.nickname.slice(0, 2)" [alt]="conv.nickname" size="sm" />
              <span class="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{{ conv.nickname }}</span>
            </button>
            @if (conv.isTyping) {
              <span class="text-xs text-blue-500 italic pr-2" aria-label="typing">typing…</span>
            }
          </header>

          <div class="flex-1 overflow-y-auto p-4 pb-6 flex flex-col gap-1 [overscroll-behavior-y:contain]" #feed role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation messages">
            @for (msg of conv.messages; track msg.id; let i = $index) {
              @let label = formatDay(conv.messages, i);
              @if (label) {
                <div
                  class="self-center py-[3px] px-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
                         rounded-full text-[10px] font-medium text-neutral-500 dark:text-neutral-400"
                  role="separator"
                >{{ label }}</div>
              }

              @switch (msg.type) {
                @case ('text') {
                  <div [class]="msgRowClass(!!msg.delivery)" role="group" [attr.aria-label]="messageAriaLabel(msg, conv)">
                    <app-chat-text-bubble [text]="msg.text" [isOutbound]="!!msg.delivery" />
                    <span [class]="msgMetaClass(!!msg.delivery)">
                      <time class="tabular-nums" [attr.datetime]="msg.ts">{{ formatTime(msg.ts) }}</time>
                      @if (msg.delivery === 'failed') {
                        <button
                          type="button"
                          class="border-0 py-0.5 px-2 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200
                                 font-[inherit] text-[10px] font-semibold cursor-pointer {{ TOUCH }}
                                 transition-[background-color,transform] duration-150
                                 hover:bg-red-200 dark:hover:bg-red-800 active:scale-[0.97]
                                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          (click)="store.retrySend(msg.id)"
                          [attr.aria-label]="'Failed to send — tap to retry'"
                        >
                          Failed · Retry
                        </button>
                      } @else if (msg.delivery) {
                        <app-chat-delivery-mark [delivery]="msg.delivery" />
                      }
                    </span>
                  </div>
                }
                @case ('image') {
                  <div [class]="msgRowClass(!!msg.delivery)" role="group" [attr.aria-label]="messageAriaLabel(msg, conv)">
                    <app-chat-image-bubble [url]="msg.imageUrl" [alt]="(msg.fromNickname || conv.nickname) + ' sent a photo'" />
                    <span [class]="msgMetaClass(!!msg.delivery)">
                      <time class="tabular-nums" [attr.datetime]="msg.ts">{{ formatTime(msg.ts) }}</time>
                      @if (msg.delivery === 'failed') {
                        <button
                          type="button"
                          class="border-0 py-0.5 px-2 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200
                                 font-[inherit] text-[10px] font-semibold cursor-pointer {{ TOUCH }}
                                 transition-[background-color,transform] duration-150
                                 hover:bg-red-200 dark:hover:bg-red-800 active:scale-[0.97]
                                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          (click)="store.retrySend(msg.id)"
                          [attr.aria-label]="'Failed to send — tap to retry'"
                        >
                          Failed · Retry
                        </button>
                      } @else if (msg.delivery) {
                        <app-chat-delivery-mark [delivery]="msg.delivery" />
                      }
                    </span>
                  </div>
                }
                @case ('gift') {
                  <div [class]="msgRowClass(!!msg.delivery)" role="group" [attr.aria-label]="messageAriaLabel(msg, conv)">
                    <app-chat-gift-bubble [count]="msg.count" [isOutbound]="!!msg.delivery" />
                    <span [class]="msgMetaClass(!!msg.delivery)">
                      <time class="tabular-nums" [attr.datetime]="msg.ts">{{ formatTime(msg.ts) }}</time>
                      @if (msg.delivery === 'failed') {
                        <button
                          type="button"
                          class="border-0 py-0.5 px-2 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200
                                 font-[inherit] text-[10px] font-semibold cursor-pointer {{ TOUCH }}
                                 transition-[background-color,transform] duration-150
                                 hover:bg-red-200 dark:hover:bg-red-800 active:scale-[0.97]
                                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          (click)="store.retrySend(msg.id)"
                          [attr.aria-label]="'Failed to send — tap to retry'"
                        >
                          Failed · Retry
                        </button>
                      } @else if (msg.delivery) {
                        <app-chat-delivery-mark [delivery]="msg.delivery" />
                      }
                    </span>
                  </div>
                }
                @case ('introduction') {
                  <div [class]="msgRowClass(!!msg.delivery)" role="group" [attr.aria-label]="messageAriaLabel(msg, conv)">
                    <app-chat-introduction-bubble
                      [target]="msg.target"
                      [context]="(msg.fromNickname || conv.nickname) + ' shared a profile'"
                      [isOutbound]="!!msg.delivery"
                      (viewProfile)="onViewProfile(msg.target.userId, msg.target.nickname, msg.target.headUrl ?? null)"
                    />
                    <span [class]="msgMetaClass(!!msg.delivery)">
                      <time class="tabular-nums" [attr.datetime]="msg.ts">{{ formatTime(msg.ts) }}</time>
                      @if (msg.delivery === 'failed') {
                        <button
                          type="button"
                          class="border-0 py-0.5 px-2 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200
                                 font-[inherit] text-[10px] font-semibold cursor-pointer {{ TOUCH }}
                                 transition-[background-color,transform] duration-150
                                 hover:bg-red-200 dark:hover:bg-red-800 active:scale-[0.97]
                                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          (click)="store.retrySend(msg.id)"
                          [attr.aria-label]="'Failed to send — tap to retry'"
                        >
                          Failed · Retry
                        </button>
                      } @else if (msg.delivery) {
                        <app-chat-delivery-mark [delivery]="msg.delivery" />
                      }
                    </span>
                  </div>
                }
                @case ('voice_room_shared') {
                  <app-chat-room-share-card
                    [cname]="msg.cname"
                    [fromName]="msg.fromNickname || conv.nickname"
                    kind="voice"
                    [listenerCount]="msg.listenerCount ?? null"
                    [isOutbound]="!!msg.delivery"
                    [roomName]="msg.roomName ?? null"
                    [topicName]="msg.topicName ?? null"
                    (join)="onJoinRoom(msg.cname, 'voice', $event)"
                  />
                }
                @case ('live_room_shared') {
                  <app-chat-room-share-card
                    [cname]="msg.cname"
                    [fromName]="msg.fromNickname || conv.nickname"
                    kind="live"
                    [isOutbound]="!!msg.delivery"
                    [activityName]="msg.activityName ?? null"
                    [topicName]="msg.topicName ?? null"
                    (join)="onJoinRoom(msg.cname, 'live', $event)"
                  />
                }
              }
            }

            @if (conv.isTyping) {
              <div class="flex items-end gap-2 max-w-[min(75%,420px)] animate-[msgIn_220ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none" aria-label="typing">
                <app-avatar
                  [alt]="conv.nickname"
                  [src]="conv.headUrl ?? ''"
                  [initials]="conv.nickname.slice(0, 2)"
                  size="xs"
                />
                <span class="inline-flex items-center gap-[3px] py-2 px-3 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                  <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400 animate-[typingPulse_1.2s_infinite] motion-reduce:animate-none"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400 animate-[typingPulse_1.2s_infinite] motion-reduce:animate-none [animation-delay:0.2s]"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-neutral-500 dark:bg-neutral-400 animate-[typingPulse_1.2s_infinite] motion-reduce:animate-none [animation-delay:0.4s]"></span>
                </span>
              </div>
            }
          </div>

          <app-chat-composer
            [draft]="draft()"
            [stagedIntroduction]="stagedIntroduction()"
            [canSend]="canSend()"
            [recipientName]="conv.nickname"
            (draftChange)="onDraft($event)"
            (send)="onSend()"
            (removeStaged)="stagedIntroduction.set(null)"
            (blur)="onComposerBlur()"
            (action)="onComposerAction($event)"
          />
        } @else {
          <app-chat-empty-state
            title="Your chats"
            body="Pick a conversation from the left to start reading."
          />
        }
      </main>
    </div>

    <app-user-picker-sheet
      id="chat-user-picker"
      [open]="pickerOpen() !== null"
      [title]="pickerTitle()"
      [tab]="pickerTab()"
      [users]="pickerUsers()"
      [byIdView]="pickerByIdResult()"
      [loading]="pickerLoading()"
      [error]="pickerError()"
      [emptyCopy]="pickerEmptyCopy()"
      [byIdQuery]="pickerByIdQuery()"
      [byIdValid]="pickerByIdValid()"
      (close)="closePicker()"
      (tabChange)="onPickerTabChange($event)"
      (pick)="onPickerPick($event)"
      (submitById)="submitById()"
      (byIdQueryChange)="pickerByIdQuery.set($event)"
    />
  `,
  /** Two bespoke keyframes: the message entrance (slide+scale-in) and the typing-dots
   *  pulse have no Tailwind built-in equivalent shape. */
  styles: [`
    @keyframes msgIn {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes typingPulse {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-2px); }
    }
  `],
})
export class ChatPageComponent {
  protected readonly store = inject(ChatStore);
  protected readonly isMobileViewport = injectIsMobileViewport();
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly profileDirectory: ChatProfileDirectory = inject(CHAT_PROFILE_DIRECTORY);
  private readonly keyboardInset = inject(KeyboardInsetService);
  protected readonly keyboardInsetPx = this.keyboardInset.keyboardInsetPx;

  protected readonly TOUCH = TOUCH;

  /** Bound from chat.routes.ts's ':userId' segment via withComponentInputBinding — the
   *  router always delivers a raw route-param string (or undefined on the parameterless
   *  '' route), never a number, so this needs the same transform pattern every other
   *  routed numeric input in the app uses (see CLAUDE.md §11). */
  readonly userId = input(null as number | null, {
    transform: (v: string | number | null | undefined) => (v == null ? null : Number(v) || null),
  });

  protected readonly searchQuery = signal('');
  protected readonly filteredConversations = computed(() =>
    filterConversationsByQuery(this.store.conversations(), this.searchQuery()),
  );

  protected readonly draft = signal('');
  protected readonly stagedIntroduction = signal<IntroductionPayload | null>(null);
  protected readonly canSend = computed(() => this.draft().trim().length > 0 || this.stagedIntroduction() !== null);

  protected readonly pickerOpen = signal<'newConversation' | 'shareProfile' | null>(null);
  protected readonly pickerTab = signal<ChatUserPickerTab>('following');
  protected readonly pickerByIdQuery = signal('');
  protected readonly pickerByIdValid = computed(() => /^\d+$/.test(this.pickerByIdQuery().trim()));
  protected readonly pickerByIdQueryId = signal<number | null>(null);

  private readonly followingRes = rxResource<readonly ChatUserSummary[], boolean | undefined>({
    params: () => (this.pickerOpen() && this.pickerTab() === 'following' ? true : undefined),
    stream: ({ params }) => params === undefined ? of([]) : from(this.profileDirectory.following(FOLLOWING_LIMIT).then((p) => p.list)),
    defaultValue: [],
  });
  private readonly followersRes = rxResource<readonly ChatUserSummary[], boolean | undefined>({
    params: () => (this.pickerOpen() && this.pickerTab() === 'followers' ? true : undefined),
    stream: ({ params }) => params === undefined ? of([]) : from(this.profileDirectory.followers(1, FOLLOWERS_LIMIT).then((p) => p.list)),
    defaultValue: [],
  });
  private readonly visitorsRes = rxResource<readonly ChatUserSummary[], boolean | undefined>({
    params: () => (this.pickerOpen() && this.pickerTab() === 'visitors' ? true : undefined),
    stream: ({ params }) => params === undefined ? of([]) : from(this.profileDirectory.visitors(1).then((p) => p.list)),
    defaultValue: [],
  });
  private readonly byIdRes = rxResource<ChatUserSummary | null, number | null>({
    params: () => this.pickerByIdQueryId(),
    stream: ({ params }) => params == null ? of(null) : from(this.profileDirectory.byId(params)),
    defaultValue: null,
  });
  protected readonly pickerByIdResult = this.byIdRes.value;

  protected readonly pickerUsers = computed<readonly ChatUserSummary[]>(() => {
    switch (this.pickerTab()) {
      case 'following': return this.followingRes.value();
      case 'followers': return this.followersRes.value();
      case 'visitors': return this.visitorsRes.value();
      case 'byId': return [];
    }
  });
  protected readonly pickerLoading = computed(() => {
    switch (this.pickerTab()) {
      case 'following': return this.followingRes.isLoading();
      case 'followers': return this.followersRes.isLoading();
      case 'visitors': return this.visitorsRes.isLoading();
      case 'byId': return this.byIdRes.isLoading();
    }
  });
  protected readonly pickerError = computed(() => {
    switch (this.pickerTab()) {
      case 'following': return this.followingRes.error() ? 'Could not load following.' : null;
      case 'followers': return this.followersRes.error() ? 'Could not load followers.' : null;
      case 'visitors': return this.visitorsRes.error() ? 'Could not load visitors.' : null;
      case 'byId': return null;
    }
  });
  protected readonly pickerTitle = computed(() => {
    if (this.pickerOpen() === 'shareProfile') return 'Share a profile';
    return 'New chat';
  });
  protected readonly pickerEmptyCopy = computed(() => {
    const tab = this.pickerTab();
    if (tab === 'byId') return 'Enter a user ID and tap Find.';
    if (tab === 'visitors') return 'No recent visitors.';
    if (tab === 'followers') return 'No followers yet.';
    return "You're not following anyone yet.";
  });

  private readonly feedEl = viewChild<ElementRef<HTMLElement>>('feed');

  private readonly typingBroadcaster = createTypingBroadcaster(
    (peerId, isTyping) => this.store.setTyping(peerId, isTyping),
    TYPING_STOP_DELAY_MS,
  );

  protected readonly formatTime = (ts: number): string => relativeTime(ts);
  protected readonly formatDay = (messages: readonly ChatMessage[], index: number): string => dayLabel(messages, index);
  protected readonly messageAriaLabel = (msg: ChatMessage, conv: ChatConversation): string =>
    chatMessageAriaLabel(msg, msg.delivery ? 'You' : conv.nickname, this.formatTime);

  /** Full class string per panel, computed rather than toggled with `[class.x]`: the
   *  mobile slide transition needs a different `visibility` delay depending on whether
   *  this panel is the one currently hiding (see PANEL_TRANSITION_* above), which isn't a
   *  single-property toggle. */
  protected readonly sidebarClass = computed(() => {
    const base =
      'flex flex-col w-80 shrink-0 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 ' +
      'overflow-hidden relative max-md:absolute max-md:inset-0 max-md:w-full max-md:z-[1] max-md:border-r-0 motion-reduce:transition-none';
    return this.store.selectedConversation()
      ? `${base} max-md:-translate-x-full max-md:invisible max-md:pointer-events-none ${PANEL_TRANSITION_DELAYED_VISIBILITY}`
      : `${base} ${PANEL_TRANSITION_PLAIN}`;
  });

  protected readonly threadClass = computed(() => {
    const base =
      'flex-1 flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950 min-h-0 ' +
      'max-md:absolute max-md:inset-0 motion-reduce:transition-none';
    return this.store.selectedConversation()
      ? `${base} max-md:translate-x-0 max-md:visible max-md:pointer-events-auto ${PANEL_TRANSITION_PLAIN}`
      : `${base} max-md:translate-x-full max-md:invisible max-md:pointer-events-none ${PANEL_TRANSITION_DELAYED_VISIBILITY}`;
  });

  protected msgRowClass(isOutbound: boolean): string {
    const base = 'flex items-end gap-1.5 max-w-[min(75%,420px)] animate-[msgIn_220ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none';
    return isOutbound ? `${base} self-end rtl:self-start` : `${base} self-start rtl:self-end`;
  }

  protected msgMetaClass(isOutbound: boolean): string {
    const base = 'inline-flex items-center gap-1 pb-0.5 self-center text-neutral-500 dark:text-neutral-400 text-[10px] leading-none';
    return isOutbound ? `${base} pr-0.5 pl-1.5` : `${base} pl-0.5 pr-1.5`;
  }

  constructor() {
    effect(() => {
      const id = this.userId();
      if (id == null) return;
      this.store.select(id);
    });

    // Autoscroll on conversation change OR new inbound message — but only if the user is
    // currently near the bottom (within AUTOSCROLL_THRESHOLD_PX). Otherwise we leave the
    // scroll position alone so the user can read older messages without the feed yanking
    // back to the bottom every time a typing indicator or delivery update re-renders.
    effect(() => {
      const conv = this.store.selectedConversation();
      if (!conv) return;
      const el = this.feedEl()?.nativeElement;
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const shouldStick = distanceFromBottom < AUTOSCROLL_THRESHOLD_PX;
      if (!shouldStick) return;
      Promise.resolve().then(() => { el.scrollTop = el.scrollHeight; });
    });

    this.destroyRef.onDestroy(() => this.typingBroadcaster.stopAll());
  }

  protected onSelect(peerUserId: string): void {
    this.store.select(peerUserId);
  }

  protected onConversationsKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = this.filteredConversations();
    if (items.length === 0) return;
    event.preventDefault();
    const idx = items.findIndex((c) => c.peerUserId === this.store.selectedPeerId());
    const cursor = idx < 0 ? -1 : idx;
    const nextIdx = event.key === 'ArrowDown'
      ? Math.min(items.length - 1, cursor + 1)
      : Math.max(0, cursor - 1);
    const target = items[nextIdx];
    if (!target || nextIdx === idx) return;
    this.store.select(target.peerUserId);
  }

  protected onViewProfile(userId: string | number, nickname: string, headUrl: string | null): void {
    const numeric = asNumericPeerId(userId);
    if (!Number.isFinite(numeric)) return;
    this.dialog.open(UserInfoModalComponent, {
      data: { userId: numeric, nickname, headUrl } satisfies UserInfoModalData,
      backdropClass: 'app-modal-backdrop',
    });
  }

  protected onRetry(): void {
    this.store.retryConnection();
  }

  protected clearSearch(input?: HTMLInputElement): void {
    this.searchQuery.set('');
    queueMicrotask(() => input?.focus());
  }

  protected togglePicker(kind: 'newConversation' | 'shareProfile'): void {
    if (this.pickerOpen() === kind) {
      this.closePicker();
      return;
    }
    this.pickerOpen.set(kind);
    this.pickerTab.set('following');
    this.pickerByIdQuery.set('');
    this.pickerByIdQueryId.set(null);
  }

  protected closePicker(): void {
    this.pickerOpen.set(null);
    this.pickerByIdQuery.set('');
    this.pickerByIdQueryId.set(null);
  }

  protected onPickerTabChange(tab: ChatUserPickerTab): void {
    this.pickerTab.set(tab);
    if (tab !== 'byId') {
      this.pickerByIdQueryId.set(null);
    }
  }

  protected onPickerPick(user: ChatUserSummary): void {
    const peerId = asNumericPeerId(user.userId);
    if (this.pickerOpen() === 'shareProfile') {
      this.stagedIntroduction.set({
        userId: peerId,
        nickname: user.nickname,
        headUrl: user.headUrl,
        nationality: user.nationality ?? null,
        sex: null,
        age: null,
        bio: null,
      });
      this.closePicker();
      return;
    }
    this.store.select(peerId);
    this.closePicker();
  }

  protected submitById(): void {
    const id = Number(this.pickerByIdQuery().trim());
    if (!Number.isFinite(id) || id <= 0) return;
    this.pickerByIdQueryId.set(id);
  }

  protected onDraft(value: string): void {
    this.draft.set(value);
    const peerId = this.selectedNumericPeerId();
    if (peerId != null) this.typingBroadcaster.notifyInput(peerId);
  }

  protected onComposerBlur(): void {
    const peerId = this.selectedNumericPeerId();
    if (peerId != null) this.typingBroadcaster.stop(peerId);
  }

  /**
   * Dispatched by the composer's attach-menu (Photo / Gift / Voice room / Live link). For
   * now we ship stub dialog prompts — production-grade pickers (image upload, gift catalog,
   * live-room picker) will live in their own features and call into the store directly.
   */
  protected onComposerAction(action: ComposerAction): void {
    switch (action) {
      case 'shareProfile':
        this.togglePicker('shareProfile');
        return;
      case 'image': {
        const peerId = this.selectedNumericPeerId();
        if (peerId == null) return;
        this.dialog
          .open<ImagePickerResult | null>(ImagePickerModalComponent, { backdropClass: 'app-modal-backdrop' })
          .closed.pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((result) => {
            if (!result) return;
            this.store.sendImage(peerId, {
              url: result.url,
              ...(result.width != null ? { width: result.width } : {}),
              ...(result.height != null ? { height: result.height } : {}),
            });
          });
        return;
      }
      case 'gift': {
        const peerId = this.selectedNumericPeerId();
        if (peerId == null) return;
        const idRaw = window.prompt('Gift ID to send');
        const id = Number(idRaw);
        if (!Number.isFinite(id) || id <= 0) return;
        const name = window.prompt('Gift name') ?? '';
        const pic = window.prompt('Gift small picture URL') ?? '';
        this.store.sendGift(peerId, {
          id,
          name,
          multiName: {},
          smallPic: pic,
          animUrl: '',
          diamondVal: 0,
          giftType: 1,
        });
        return;
      }
      case 'voice_room':
      case 'live_link': {
        const peerId = this.selectedNumericPeerId();
        if (peerId == null) return;
        const cname = window.prompt('Room cname to share');
        if (!cname) return;
        if (action === 'voice_room') this.store.sendVoiceRoom(peerId, cname);
        else this.store.sendLiveLink(peerId, cname);
        return;
      }
    }
  }

  /**
   * Voice rooms live at /room/:cname/2 (RoomPageComponent's default busiType), live/video
   * rooms at /room/video/:cname/1 (VideoRoomPageComponent's default busiType) — see
   * room.routes.ts. Chat can't import the room feature directly (features never import
   * features — CLAUDE.md §3), so this navigates by URL instead, the same decoupling the
   * router itself is built for.
   */
  protected onJoinRoom(cname: string, kind: 'voice' | 'live', mode: 'visible' | 'invisible' = 'visible'): void {
    const visible = mode === 'visible';
    if (kind === 'voice') {
      void this.router.navigate(['/room', cname, 2], visible ? undefined : { queryParams: { invisible: '1' } });
    } else {
      void this.router.navigate(['/room', 'video', cname, 1], visible ? undefined : { queryParams: { invisible: '1' } });
    }
  }

  protected onSend(): void {
    const peerId = this.selectedNumericPeerId();
    if (peerId == null) return;
    const intro = this.stagedIntroduction();
    if (intro) {
      this.store.sendIntroduction(peerId, intro);
      this.stagedIntroduction.set(null);
    } else {
      const text = this.draft().trim();
      if (!text) return;
      this.store.sendText(peerId, text);
    }
    this.draft.set('');
    this.typingBroadcaster.stop(peerId);
  }

  private selectedNumericPeerId(): number | null {
    const conv = this.store.selectedConversation();
    if (!conv) return null;
    const peerId = asNumericPeerId(conv.peerUserId);
    return Number.isFinite(peerId) ? peerId : null;
  }

  @HostListener('keydown.escape')
  protected onEscape(): void {
    if (this.pickerOpen() !== null) {
      this.closePicker();
      return;
    }
    if (this.store.selectedConversation()) this.store.deselect();
  }
}
