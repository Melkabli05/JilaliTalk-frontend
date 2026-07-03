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
import { MessagesSearchComponent } from '../ui/search/messages-search';
import { MessagesStore } from '../store/messages.store';
import type { DmConversation, DmMessage } from '../models/dm.model';

const GROUP_GAP_MS = 5 * 60 * 1000;

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
                    {{ relativeTime(conv.lastTs) }}
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
  styles: [
    `
      /* This route isn't immersive, so .app-main (app.ts) already reserves header
       space via its own padding-top — this host just needs a definite height for
       .shell's height:100% to resolve against, not its own offset on top of that
       (room-page.ts owns its offset because immersive routes zero out .app-main's
       padding; standalone routes like this one don't opt out of it). */
      :host {
        display: block;
        box-sizing: border-box;
        height: 100%;
        overflow: hidden;
      }

      /* ─── Shell ──────────────────────────────────────── */
      .shell {
        display: flex;
        height: 100%;
        overflow: hidden;
      }

      /* ─── Sidebar ────────────────────────────────────── */
      .sidebar {
        width: 320px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        background: var(--color-card);
        border-right: 1px solid var(--color-border);
        overflow: hidden;
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-5) var(--space-4) var(--space-3);
        flex-shrink: 0;
      }

      .sidebar-title {
        margin: 0;
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        color: var(--color-text);
        letter-spacing: -0.02em;
        line-height: 1;
      }

      /* Live / connecting / offline dot */
      .conn-dot {
        width: 8px;
        height: 8px;
        border-radius: var(--radius-full);
        background: var(--color-neutral-300);
        flex-shrink: 0;
        transition: background-color 0.2s ease;
      }
      .conn-dot.connected {
        background: var(--color-accent-500);
      }
      .conn-dot.connecting {
        background: var(--color-gold-400);
        animation: var(--animate-pulse-live);
      }
      .conn-dot.disconnected {
        background: var(--color-neutral-400);
      }

      /* ─── Search ─────────────────────────────────────── */
      .search-wrap {
        padding: var(--space-4) var(--space-2);
        flex-shrink: 0;
      }

      /* ─── Conversation count ─────────────────────────── */
      .conv-count {
        padding: 0 var(--space-4) var(--space-2);
        font-size: var(--text-2xs);
        font-weight: var(--font-medium);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: var(--letter-spacing-wide);
        flex-shrink: 0;
      }

      /* ─── Conversation list ──────────────────────────── */
      ul {
        flex: 1;
        overflow-y: auto;
        list-style: none;
        margin: 0;
        padding: 0 var(--space-2) var(--space-2);
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;
      }

      li {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-2) var(--space-3);
        border-radius: var(--radius-lg);
        cursor: pointer;
        transition: background-color 0.15s ease;
        position: relative;
        margin-bottom: 2px;
        user-select: none;
      }

      /* left accent bar — appears on active */
      li::before {
        content: '';
        position: absolute;
        left: 0;
        top: 25%;
        bottom: 25%;
        width: 3px;
        border-radius: var(--radius-full);
        background: var(--color-primary-500);
        opacity: 0;
        transition: opacity 0.15s ease;
      }

      li:hover {
        background: var(--color-neutral-100);
      }
      li.active {
        background: color-mix(in srgb, var(--color-primary-500) 8%, transparent);
      }
      li.active::before {
        opacity: 1;
      }

      :host-context(.dark) li:hover {
        background: var(--color-neutral-700);
      }
      :host-context(.dark) li.active {
        background: color-mix(in srgb, var(--color-primary-500) 14%, transparent);
      }

      li:focus-visible {
        outline: var(--focus-ring);
        outline-offset: -2px;
      }

      /* unread treatment — heavier name, colored preview */
      li.unread .row-name {
        font-weight: var(--font-bold);
        color: var(--color-text);
      }
      li.unread .row-preview {
        color: var(--color-text-secondary);
      }
      li.unread .row-ts {
        color: var(--color-accent-600);
        font-weight: var(--font-medium);
      }

      .row-body {
        flex: 1;
        min-width: 0;
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-rows: auto auto;
        row-gap: 2px;
        column-gap: var(--space-2);
        align-items: center;
      }

      .row-name {
        grid-column: 1;
        grid-row: 1;
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--color-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .row-ts {
        grid-column: 2;
        grid-row: 1;
        font-size: var(--text-2xs);
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .row-preview {
        grid-column: 1;
        grid-row: 2;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }

      .typing-preview {
        color: var(--color-primary-500);
      }
      .typing-label {
        font-style: italic;
      }

      .unread-badge {
        grid-column: 2;
        grid-row: 2;
        align-self: center;
        min-width: 18px;
        height: 18px;
        padding: 0 var(--space-1);
        border-radius: var(--radius-full);
        background: var(--color-accent-500);
        color: var(--color-on-color);
        font-size: var(--text-2xs);
        font-weight: var(--font-bold);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: badge-pop 0.2s ease;
      }

      @keyframes badge-pop {
        0% {
          transform: scale(0.5);
          opacity: 0;
        }
        70% {
          transform: scale(1.15);
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }

      /* ─── Typing dots (shared) ───────────────────────── */
      .typing-dots {
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .dot {
        width: 4px;
        height: 4px;
        border-radius: var(--radius-full);
        background: currentColor;
        opacity: 0.6;
        animation: typing-bounce 1.1s ease-in-out infinite;
      }
      .dot:nth-child(2) {
        animation-delay: 0.15s;
      }
      .dot:nth-child(3) {
        animation-delay: 0.3s;
      }

      @keyframes typing-bounce {
        0%,
        100% {
          transform: translateY(0);
          opacity: 0.45;
        }
        50% {
          transform: translateY(-4px);
          opacity: 1;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .dot {
          animation: none;
          opacity: 0.6;
        }
      }

      /* ─── Empty state ────────────────────────────────── */
      .empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        padding: var(--space-8);
        text-align: center;
      }

      .empty-icon {
        width: 64px;
        height: 64px;
        margin-bottom: var(--space-2);
        border-radius: var(--radius-xl);
        background: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
        color: var(--color-primary-500);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      :host-context(.dark) .empty-icon {
        background: color-mix(in srgb, var(--color-primary-500) 16%, transparent);
      }

      .empty-title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text);
      }
      .empty-body {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        max-width: 200px;
        line-height: var(--leading-relaxed);
      }

      /* ─── Thread pane ────────────────────────────────── */
      .thread {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--color-bg);
      }

      /* Mobile-only back bar */
      .mobile-bar {
        display: none;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: var(--color-card);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .back-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-primary-500);
        cursor: pointer;
        flex-shrink: 0;
        transition: background-color 0.15s ease;
      }
      .back-btn:hover {
        background: var(--color-neutral-100);
      }
      .back-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }
      :host-context(.dark) .back-btn:hover {
        background: var(--color-neutral-700);
      }

      .mobile-bar-identity {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex: 1;
        min-width: 0;
      }
      .mobile-bar-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ─── Feed ───────────────────────────────────────── */
      .feed {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-4) var(--space-4) var(--space-2);
        display: flex;
        flex-direction: column;
        gap: 3px;
        scrollbar-width: thin;
        scrollbar-color: var(--color-border) transparent;
      }

      /* Date pill separator */
      .date-pill {
        align-self: center;
        padding: 3px var(--space-3);
        margin: var(--space-3) 0 var(--space-1);
        background: var(--color-neutral-100);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        font-size: var(--text-2xs);
        font-weight: var(--font-medium);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: var(--letter-spacing-wide);
        user-select: none;
      }
      :host-context(.dark) .date-pill {
        background: var(--color-neutral-800);
      }

      /* Message row */
      .msg {
        display: flex;
        align-items: flex-end;
        gap: var(--space-2);
      }
      .msg.tail {
        margin-bottom: var(--space-1);
      }

      /* Avatar column */
      .msg-avatar {
        flex-shrink: 0;
      }
      .msg-avatar-gap {
        width: 20px;
        flex-shrink: 0;
      } /* same width as xs avatar */

      /* Bubble */
      .bubble {
        max-width: min(68%, 420px);
        background: var(--color-card);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-xs);
        padding: var(--space-2) var(--space-3);
        display: flex;
        flex-direction: column;
        gap: 3px;
        box-shadow: var(--shadow-xs);
        transition: box-shadow 0.15s ease;
      }
      .bubble:hover {
        box-shadow: var(--shadow-sm);
      }

      /* First message in a group: connect visually with its avatar */
      .msg.first .bubble {
        border-bottom-left-radius: var(--radius-xl);
        border-top-left-radius: var(--radius-sm);
      }
      /* Mid-group (not first, not tail) */
      .msg:not(.first):not(.tail) .bubble {
        border-top-left-radius: var(--radius-xs);
        border-bottom-left-radius: var(--radius-xs);
      }
      /* Tail but not first */
      .msg.tail:not(.first) .bubble {
        border-top-left-radius: var(--radius-xs);
        border-bottom-left-radius: var(--radius-xl);
      }

      .bubble p {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text);
        line-height: var(--leading-normal);
        word-break: break-word;
        white-space: pre-wrap;
      }

      .bubble-meta {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        font-style: italic;
      }

      .bubble img {
        max-width: 100%;
        max-height: 260px;
        object-fit: cover;
        border-radius: var(--radius-lg);
        display: block;
      }

      .bubble-time {
        display: block;
        font-size: var(--text-2xs);
        color: var(--color-text-muted);
        text-align: right;
        margin-top: 1px;
      }

      /* Typing bubble in feed */
      .typing-bubble {
        padding: var(--space-2) var(--space-3);
        color: var(--color-primary-400);
      }
      .typing-row {
        opacity: 1;
      }

      /* ─── Compose ────────────────────────────────────── */
      .compose {
        padding: var(--space-3) var(--space-4);
        border-top: 1px solid var(--color-border);
        background: var(--color-card);
        flex-shrink: 0;
      }

      .compose-field {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        height: 44px;
        padding: 0 var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        background: var(--color-neutral-100);
        cursor: not-allowed;
        opacity: 0.7;
      }
      :host-context(.dark) .compose-field {
        background: var(--color-neutral-800);
      }

      .compose-msg-icon {
        color: var(--color-text-muted);
        flex-shrink: 0;
      }

      .compose-placeholder {
        flex: 1;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        user-select: none;
      }

      .compose-lock {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: 3px var(--space-2);
        border-radius: var(--radius-full);
        background: var(--color-neutral-200);
        color: var(--color-text-muted);
        font-size: var(--text-2xs);
        font-weight: var(--font-medium);
        white-space: nowrap;
        flex-shrink: 0;
      }
      :host-context(.dark) .compose-lock {
        background: var(--color-neutral-700);
      }

      /* ─── No-selection ───────────────────────────────── */
      .no-selection {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        padding: var(--space-8);
        text-align: center;
      }

      .no-selection-icon {
        width: 80px;
        height: 80px;
        border-radius: var(--radius-2xl);
        background: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
        color: var(--color-primary-400);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 0 8px color-mix(in srgb, var(--color-primary-500) 5%, transparent);
      }
      :host-context(.dark) .no-selection-icon {
        background: color-mix(in srgb, var(--color-primary-500) 16%, transparent);
        box-shadow: 0 0 0 8px color-mix(in srgb, var(--color-primary-500) 8%, transparent);
        color: var(--color-primary-300);
      }

      .no-selection-title {
        margin: 0;
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--color-text);
      }
      .no-selection-body {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        max-width: 240px;
        line-height: var(--leading-relaxed);
      }

      /* ─── Mobile breakpoint ──────────────────────────── */
      @media (max-width: 640px) {
        .sidebar {
          position: absolute;
          inset: 0;
          width: 100%;
          z-index: 1;
          border-right: none;
          transform: translateX(0);
          transition:
            transform 0.22s cubic-bezier(0.4, 0, 0.2, 1),
            visibility 0.22s;
        }
        .sidebar.hidden {
          transform: translateX(-100%);
          visibility: hidden;
          pointer-events: none;
        }
        .thread {
          position: absolute;
          inset: 0;
          transform: translateX(100%);
          visibility: hidden;
          pointer-events: none;
          transition:
            transform 0.22s cubic-bezier(0.4, 0, 0.2, 1),
            visibility 0.22s;
        }
        .thread.open {
          transform: translateX(0);
          visibility: visible;
          pointer-events: auto;
        }
        .mobile-bar {
          display: flex;
        }
      }
    `,
  ],
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

  protected isGroupStart(messages: readonly DmMessage[], i: number): boolean {
    const cur = messages[i];
    const prev = messages[i - 1];
    if (!prev || !cur) return true;
    return cur.ts - prev.ts > GROUP_GAP_MS;
  }

  protected isGroupEnd(messages: readonly DmMessage[], i: number): boolean {
    const cur = messages[i];
    const next = messages[i + 1];
    if (!next || !cur) return true;
    return next.ts - cur.ts > GROUP_GAP_MS;
  }

  protected dateLabel(messages: readonly DmMessage[], i: number): string | null {
    const msg = messages[i];
    if (!msg) return null;
    const prev = messages[i - 1];
    const d = new Date(msg.ts);
    if (prev && new Date(prev.ts).toDateString() === d.toDateString()) return null;
    return this.dayLabel(d);
  }

  private dayLabel(d: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  protected preview(conv: DmConversation): string {
    const last = conv.messages.at(-1);
    if (!last) return '';
    switch (last.type) {
      case 'text':
        return last.text ?? '';
      case 'image':
        return 'Photo';
      case 'gift':
        return `Gift ×${last.count ?? 1}`;
      case 'introduction':
        return 'Introduction';
    }
  }

  protected relativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    if (hrs < 48) return 'Yesterday';
    const d = new Date(ts);
    const now = new Date();
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  }

  protected fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
