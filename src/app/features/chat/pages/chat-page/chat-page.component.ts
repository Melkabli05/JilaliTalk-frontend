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
import { rxResource } from '@angular/core/rxjs-interop';
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
import { ChatUserPickerSheetComponent } from '../../ui/chat-user-picker-sheet.component';
import { ChatEmptyStateComponent } from '../../ui/chat-empty-state.component';

const TYPING_STOP_DELAY_MS = 3000;
/** How close to the bottom the user must be (in px) before an inbound message or conversation
 *  switch will autoscroll them. Larger = stickier (always scroll), smaller = more forgiving
 *  (let the user stay at their scrolled position while older messages load). */
const AUTOSCROLL_THRESHOLD_PX = 80;
const FOLLOWING_LIMIT = 50;
const FOLLOWERS_LIMIT = 50;

@Component({
  selector: 'app-chat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ChatStore],
  host: {
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
    ChatUserPickerSheetComponent,
    ChatEmptyStateComponent,
    LucideChevronLeft,
    LucidePlus,
    LucideSearch,
    LucideX,
  ],
  template: `
    <div class="chat-shell" [inert]="pickerOpen() !== null">
      <aside class="sidebar" [class.hidden]="store.selectedConversation()">
        <header class="sidebar-header">
          <h1 class="sidebar-title">Chat</h1>
          <div class="sidebar-actions">
            <app-chat-connection-pill [status]="store.connectionStatus()" (retry)="onRetry()" />
            <button
              type="button"
              class="icon-btn"
              (click)="togglePicker('newConversation')"
              [attr.aria-label]="pickerOpen() === 'newConversation' ? 'Close new chat panel' : 'New chat'"
              [attr.aria-expanded]="pickerOpen() === 'newConversation'"
              aria-controls="chat-user-picker"
            >
              <svg aria-hidden="true" lucidePlus [size]="16"></svg>
            </button>
          </div>
        </header>

        <div class="search-wrap">
          <svg aria-hidden="true" lucideSearch [size]="14" class="search-icon"></svg>
          <input
            #searchInput
            type="search"
            class="search-input"
            placeholder="Search conversations"
            aria-label="Search conversations"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
          />
          @if (searchQuery()) {
            <button type="button" class="search-clear" aria-label="Clear search" (click)="clearSearch(searchInput)">
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
            class="conversations"
            role="listbox"
            aria-label="Conversations"
            (keydown)="onConversationsKeydown($event)"
            tabindex="0"
          >
            @for (conv of filteredConversations(); track conv.peerUserId) {
              <li role="option" [attr.aria-selected]="store.selectedPeerId() === conv.peerUserId">
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

      <main class="thread" [class.open]="store.selectedConversation()">
        @if (store.selectedConversation(); as conv) {
          <header class="thread-bar">
            <button
              type="button"
              class="back-btn"
              (click)="store.deselect()"
              aria-label="Back to conversations"
            >
              <svg aria-hidden="true" lucideChevronLeft [size]="18"></svg>
            </button>
            <button
              type="button"
              class="thread-identity"
              (click)="onViewProfile(conv.peerUserId, conv.nickname, conv.headUrl)"
              [attr.aria-label]="'View ' + conv.nickname + '’s profile'"
            >
              <app-avatar [src]="conv.headUrl ?? ''" [initials]="conv.nickname.slice(0, 2)" [alt]="conv.nickname" size="sm" />
              <span class="thread-name">{{ conv.nickname }}</span>
            </button>
            @if (conv.isTyping) {
              <span class="typing-label" aria-label="typing">typing…</span>
            }
          </header>

          <div class="feed" #feed role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation messages">
            @for (msg of conv.messages; track msg.id; let i = $index) {
              @let label = formatDay(conv.messages, i);
              @if (label) {
                <div class="date-pill" role="separator">{{ label }}</div>
              }

              @switch (msg.type) {
                @case ('text') {
                  <div class="msg-row" [class.is-outbound]="!!msg.delivery" role="group" [attr.aria-label]="messageAriaLabel(msg, conv)">
                    <app-chat-text-bubble [text]="msg.text" [isOutbound]="!!msg.delivery" />
                    <span class="msg-meta">
                      <time class="msg-time" [attr.datetime]="msg.ts">{{ formatTime(msg.ts) }}</time>
                      @if (msg.delivery) {
                        <app-chat-delivery-mark [delivery]="msg.delivery" />
                      }
                    </span>
                  </div>
                }
                @case ('image') {
                  <div class="msg-row" [class.is-outbound]="!!msg.delivery" role="group" [attr.aria-label]="messageAriaLabel(msg, conv)">
                    <app-chat-image-bubble [url]="msg.imageUrl" [alt]="(msg.fromNickname || conv.nickname) + ' sent a photo'" />
                    <span class="msg-meta">
                      <time class="msg-time" [attr.datetime]="msg.ts">{{ formatTime(msg.ts) }}</time>
                      @if (msg.delivery) {
                        <app-chat-delivery-mark [delivery]="msg.delivery" />
                      }
                    </span>
                  </div>
                }
                @case ('gift') {
                  <div class="msg-row" [class.is-outbound]="!!msg.delivery" role="group" [attr.aria-label]="messageAriaLabel(msg, conv)">
                    <app-chat-gift-bubble [count]="msg.count" [isOutbound]="!!msg.delivery" />
                    <span class="msg-meta">
                      <time class="msg-time" [attr.datetime]="msg.ts">{{ formatTime(msg.ts) }}</time>
                      @if (msg.delivery) {
                        <app-chat-delivery-mark [delivery]="msg.delivery" />
                      }
                    </span>
                  </div>
                }
                @case ('introduction') {
                  <div class="msg-row" [class.is-outbound]="!!msg.delivery" role="group" [attr.aria-label]="messageAriaLabel(msg, conv)">
                    <app-chat-introduction-bubble
                      [target]="msg.target"
                      [context]="(msg.fromNickname || conv.nickname) + ' shared a profile'"
                      [isOutbound]="!!msg.delivery"
                      (viewProfile)="onViewProfile(msg.target.userId, msg.target.nickname, msg.target.headUrl ?? null)"
                    />
                    <span class="msg-meta">
                      <time class="msg-time" [attr.datetime]="msg.ts">{{ formatTime(msg.ts) }}</time>
                      @if (msg.delivery) {
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
                  />
                }
                @case ('live_room_shared') {
                  <app-chat-room-share-card
                    [cname]="msg.cname"
                    [fromName]="msg.fromNickname || conv.nickname"
                    kind="live"
                    [isOutbound]="!!msg.delivery"
                  />
                }
              }
            }

            @if (conv.isTyping) {
              <div class="msg-row typing-row" aria-label="typing">
                <app-avatar
                  [alt]="conv.nickname"
                  [src]="conv.headUrl ?? ''"
                  [initials]="conv.nickname.slice(0, 2)"
                  size="xs"
                />
                <span class="typing-dots">
                  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
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

    <app-chat-user-picker-sheet
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
  styles: [`
    :host { display: block; height: 100%; }
    .chat-shell {
      display: flex;
      height: calc(100% - var(--kb-inset, 0px));
      overflow: hidden; position: relative;
    }
    .chat-shell button, .chat-shell [role="option"], .chat-shell [role="tab"] {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .sidebar {
      width: 320px; flex-shrink: 0; display: flex;
      flex-direction: column; background: var(--color-card);
      border-right: 1px solid var(--color-border);
      overflow: hidden; position: relative;
    }
    .sidebar-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-4); flex-shrink: 0;
      border-bottom: 1px solid var(--color-border);
      position: sticky; top: 0; z-index: 2;
      background: color-mix(in srgb, var(--color-card) 92%, transparent);
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
    }
    .sidebar-title {
      margin: 0; font-size: var(--text-xl); font-weight: var(--font-bold);
      color: var(--color-text);
    }
    .sidebar-actions { display: inline-flex; align-items: center; gap: var(--space-2); }
    .icon-btn {
      width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
      border: 0; background: var(--color-primary-500); color: var(--color-card);
      border-radius: var(--radius-full); cursor: pointer;
    }
    .icon-btn:hover { background: var(--color-primary-600); }
    .icon-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .search-wrap {
      position: relative; padding: var(--space-2) var(--space-3); flex-shrink: 0;
    }
    .search-icon {
      position: absolute; left: var(--space-5); top: 50%;
      transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none;
    }
    .search-input {
      width: 100%; height: 36px;
      padding: 0 36px;
      border: 1px solid var(--color-border); border-radius: var(--radius-full);
      background: var(--color-neutral-100);
      font-size: max(16px, var(--text-sm)); color: var(--color-text);
      outline: none;
    }
    .search-input:focus { background: var(--color-card); border-color: var(--color-primary-400); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 12%, transparent); }
    .search-clear {
      position: absolute; right: var(--space-4); top: 50%;
      transform: translateY(-50%);
      width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
      border: 0; background: transparent; color: var(--color-text-muted);
      border-radius: var(--radius-full); cursor: pointer;
    }
    .search-clear:hover { background: var(--color-neutral-200); color: var(--color-text); }
    .search-clear:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .conversations {
      flex: 1; overflow-y: auto; list-style: none; margin: 0;
      padding: var(--space-1) var(--space-2) var(--space-2);
    }
    .conversations li { margin-bottom: 2px; }

    .thread { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--color-bg); min-height: 0; }
    .thread-bar {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: color-mix(in srgb, var(--color-card) 92%, transparent);
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
    }
    .back-btn {
      width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
      border: 0; background: transparent; color: var(--color-primary-500);
      border-radius: var(--radius-md); cursor: pointer; flex-shrink: 0;
    }
    .back-btn:hover { background: var(--color-neutral-100); }
    .back-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .thread-identity {
      display: inline-flex; align-items: center; gap: var(--space-2);
      border: 0; background: transparent; cursor: pointer; flex: 1;
      text-align: left; padding: 4px 6px; border-radius: var(--radius-md);
      color: var(--color-text); min-width: 0;
    }
    .thread-identity:hover { background: var(--color-neutral-100); }
    .thread-identity:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .thread-name { font-weight: var(--font-semibold); font-size: var(--text-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .typing-label { font-size: var(--text-xs); color: var(--color-primary-500); font-style: italic; padding-right: var(--space-2); }
    .feed { flex: 1; overflow-y: auto; padding: var(--space-4) var(--space-4) var(--space-6); display: flex; flex-direction: column; gap: var(--space-1); overscroll-behavior-y: contain; }
    .msg-row {
      display: flex; align-items: flex-end; gap: 6px; max-width: min(75%, 420px);
      animation: msgIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .msg-row.is-outbound { align-self: flex-end; flex-direction: row; }
    .msg-row:not(.is-outbound) { align-self: flex-start; }
    :host-context([dir='rtl']) .msg-row.is-outbound { align-self: flex-start; }
    :host-context([dir='rtl']) .msg-row:not(.is-outbound) { align-self: flex-end; }
    .msg-meta {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 0 6px 2px;
      align-self: center;
      color: var(--color-text-muted);
      font-size: var(--text-2xs);
      line-height: 1;
    }
    .msg-row.is-outbound .msg-meta { padding-right: 2px; padding-left: 6px; }
    .msg-row:not(.is-outbound) .msg-meta { padding-left: 2px; padding-right: 6px; }
    .msg-time { font-variant-numeric: tabular-nums; }
    @keyframes msgIn {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .date-pill { align-self: center; padding: 3px var(--space-3); background: var(--color-neutral-100); border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: var(--text-2xs); font-weight: var(--font-medium); color: var(--color-text-muted); }
    :host-context(.dark) .date-pill { background: var(--color-neutral-800); }
    .typing-row { gap: var(--space-2); }
    .typing-dots { display: inline-flex; align-items: center; gap: 3px; padding: 8px 12px; background: var(--color-neutral-100); border-radius: var(--radius-full); }
    .typing-dots .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-text-muted); animation: typingPulse 1.2s infinite; }
    .typing-dots .dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingPulse {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-2px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .typing-dots .dot { animation: none; }
      .msg-row { animation: none; }
      .sidebar, .thread { transition: none; }
    }

    @media (max-width: 767.98px) {
      .sidebar {
        position: absolute; inset: 0;
        width: 100%; z-index: 1;
        border-right: none;
      }
      .sidebar, .thread { transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1); }
      .sidebar.hidden { transform: translateX(-100%); visibility: hidden; pointer-events: none; transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1), visibility 0ms 280ms; }
      .thread { position: absolute; inset: 0; transform: translateX(100%); visibility: hidden; pointer-events: none; }
      .thread.open { transform: translateX(0); visibility: visible; pointer-events: auto; }
      .thread:not(.open) { transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1), visibility 0ms 280ms; }
      .search-input { height: 44px; }
      .icon-btn { width: 44px; height: 44px; }
      .search-clear { width: 44px; height: 44px; right: var(--space-2); }
      .back-btn { width: 44px; height: 44px; }
      .thread-identity { min-height: 44px; }
    }
  `],
})
export class ChatPageComponent {
  protected readonly store = inject(ChatStore);
  protected readonly isMobileViewport = injectIsMobileViewport();
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly profileDirectory: ChatProfileDirectory = inject(CHAT_PROFILE_DIRECTORY);
  private readonly keyboardInset = inject(KeyboardInsetService);
  protected readonly keyboardInsetPx = this.keyboardInset.keyboardInsetPx;

  readonly userId = input<number | null>(null);

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
        const url = window.prompt('Image URL to send');
        if (!url) return;
        this.store.sendImage(peerId, { url });
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