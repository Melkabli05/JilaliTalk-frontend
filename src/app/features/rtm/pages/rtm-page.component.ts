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
  LucideSearch,
  LucideX,
  LucideInbox,
  LucideMessageSquare,
  LucideGift,
} from '@lucide/angular';
import { ImSocketService } from '@core/realtime/im-socket.service';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { RtmStore } from '../store/rtm.store';
import type { DmConversation, DmMessage } from '../models/rtm.model';

@Component({
  selector: 'app-rtm-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RtmStore],
  imports: [AvatarComponent, LucideChevronLeft, LucideSearch, LucideX, LucideInbox, LucideMessageSquare, LucideGift],
  template: `
    <div class="shell">

      <!-- ─── Sidebar ─── -->
      <aside class="sidebar" [class.hidden]="store.selected()">

        <div class="sidebar-header">
          <h1 class="sidebar-title">Messages</h1>
          <span class="conn-dot" [class]="imSocket.status()" aria-hidden="true"></span>
        </div>

        <div class="search-bar">
          <svg aria-hidden="true" lucideSearch [size]="14" class="search-icon"></svg>
          <input
            class="search-input"
            type="search"
            placeholder="Search…"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            (keydown.escape)="searchQuery.set('')"
            aria-label="Search conversations"
          />
          @if (searchQuery()) {
            <button
              type="button"
              class="search-clear"
              (click)="searchQuery.set('')"
              aria-label="Clear search"
            >
              <svg aria-hidden="true" lucideX [size]="11"></svg>
            </button>
          }
        </div>

        @if (filteredConversations().length === 0) {
          <div class="empty">
            <div class="empty-icon">
              <svg aria-hidden="true" lucideInbox [size]="26"></svg>
            </div>
            <div class="empty-text">
              @if (searchQuery()) {
                <h3>No results</h3>
                <p>No conversations match "{{ searchQuery() }}"</p>
              } @else {
                <h3>No messages yet</h3>
                <p>Direct messages will appear here as they arrive.</p>
              }
            </div>
          </div>
        } @else {
          <ul>
            @for (conv of filteredConversations(); track conv.userId) {
              <li
                [class.active]="store.selectedId() === conv.userId"
                (click)="store.select(conv.userId)"
                tabindex="0"
                role="button"
                (keydown.enter)="store.select(conv.userId)"
              >
                <app-avatar [alt]="conv.nickname" size="md" />
                <div class="row-body">
                  <span class="row-name">{{ conv.nickname }}</span>
                  <time class="row-ts">{{ fmtTime(conv.lastTs) }}</time>
                  @if (conv.isTyping) {
                    <span class="row-preview" aria-label="typing">
                      <span class="typing-dots" aria-hidden="true">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                      </span>
                    </span>
                  } @else {
                    <span class="row-preview">{{ preview(conv) }}</span>
                  }
                  @if (conv.unread > 0) {
                    <span class="badge" [attr.aria-label]="conv.unread + ' unread'">
                      {{ conv.unread > 99 ? '99+' : conv.unread }}
                    </span>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </aside>

      <!-- ─── Thread ─── -->
      <main class="thread" [class.open]="store.selected()">

        @if (store.selected(); as conv) {

          <!-- mobile-only back bar -->
          <div class="mobile-bar">
            <button class="back-btn" (click)="store.back()" aria-label="Back to conversations">
              <svg aria-hidden="true" lucideChevronLeft [size]="18"></svg>
            </button>
            <span class="mobile-bar-name">{{ conv.nickname }}</span>
            @if (conv.isTyping) {
              <span class="typing-dots mobile-typing" aria-label="typing" aria-hidden="true">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </span>
            }
          </div>

          <div class="feed" #feed>
            @for (msg of conv.messages; track msg.id; let i = $index) {
              <div class="msg" [class.tail]="isLastInGroup(conv.messages, i)">
                <div class="bubble">
                  @switch (msg.type) {
                    @case ('text') { <p>{{ msg.text }}</p> }
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
                        <svg aria-hidden="true" lucideMessageSquare [size]="13"></svg>
                        Introduction
                      </span>
                    }
                  }
                  <time>{{ fmtTime(msg.ts) }}</time>
                </div>
              </div>
            }
          </div>

          <div class="compose">
            <div class="compose-hint">
              <span>Replies coming soon</span>
            </div>
          </div>

        } @else {

          <div class="no-selection">
            <div class="no-selection-icon">
              <svg aria-hidden="true" lucideMessageSquare [size]="32"></svg>
            </div>
            <div class="no-selection-text">
              <p>Select a conversation</p>
              <span>Choose from the list on the left</span>
            </div>
          </div>

        }
      </main>

    </div>
  `,
  styles: [`
    /* ─── shell ─────────────────────────────────────── */
    :host { display: block; }

    .shell {
      display: flex;
      height: 100%;
      position: relative;
      overflow: hidden;
    }

    /* ─── sidebar ────────────────────────────────────── */
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
      padding: var(--space-4);
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }

    .sidebar-title {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--color-text);
    }

    .conn-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-300);
      flex-shrink: 0;
      transition: background-color 0.15s ease;
    }

    .conn-dot.connected    { background: var(--color-accent-500); }
    .conn-dot.connecting   { background: var(--color-gold-400); animation: var(--animate-pulse-live); }
    .conn-dot.disconnected { background: var(--color-neutral-400); }

    /* ─── search bar ─────────────────────────────────── */
    .search-bar {
      position: relative;
      display: flex;
      align-items: center;
      padding: var(--space-2) var(--space-3);
      border-bottom: 1px solid var(--color-border);
      flex-shrink: 0;
    }

    .search-icon {
      position: absolute;
      left: calc(var(--space-3) + var(--space-2));
      color: var(--color-text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 34px;
      padding: 0 var(--space-8) 0 calc(var(--space-3) + 22px);
      border: none;
      border-radius: var(--radius-lg);
      background: var(--color-neutral-100);
      color: var(--color-text);
      font-size: var(--text-sm);
      transition: box-shadow 0.15s ease;
    }

    .search-input::placeholder { color: var(--color-text-muted); }

    .search-input:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px var(--color-primary-400);
    }

    .search-input::-webkit-search-cancel-button,
    .search-input::-webkit-search-decoration { display: none; }

    .search-clear {
      position: absolute;
      right: calc(var(--space-3) + var(--space-2));
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: var(--radius-full);
      background: var(--color-neutral-200);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .search-clear:hover { background: var(--color-neutral-300); color: var(--color-text); }
    .search-clear:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    :host-context(.dark) {
      .search-input { background: var(--color-neutral-800); }
      .search-input:focus-visible { box-shadow: 0 0 0 2px var(--color-primary-300); }
      .search-clear { background: var(--color-neutral-700); color: var(--color-neutral-400); }
      .search-clear:hover { background: var(--color-neutral-600); color: var(--color-neutral-100); }
    }

    /* ─── conversation list ──────────────────────────── */
    ul {
      flex: 1;
      overflow-y: auto;
      list-style: none;
      margin: 0;
      padding: var(--space-1) var(--space-2);
      scrollbar-width: thin;
      /* --color-border is neutral-200 light / neutral-700 dark — no override needed */
      scrollbar-color: var(--color-border) transparent;
    }

    li {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      border-radius: var(--radius-lg);
      transition: background-color 0.15s ease;
      margin-bottom: 1px;
    }

    li:hover  { background: var(--color-neutral-100); }
    li.active { background: color-mix(in srgb, var(--color-primary-500) 10%, transparent); }

    :host-context(.dark) li:hover { background: var(--color-neutral-700); }

    li:focus-visible { outline: var(--focus-ring); outline-offset: -2px; }

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
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      grid-column: 1;
      grid-row: 1;
    }

    .row-ts {
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
      white-space: nowrap;
      grid-column: 2;
      grid-row: 1;
    }

    .row-preview {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      grid-column: 1;
      grid-row: 2;
      display: flex;
      align-items: center;
    }

    .badge {
      grid-column: 2;
      grid-row: 2;
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
      align-self: center;
    }

    /* ─── typing dots ────────────────────────────────── */
    .typing-dots {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }

    .dot {
      width: 4px;
      height: 4px;
      border-radius: var(--radius-full);
      background: var(--color-primary-500);
      animation: typing-bounce 1.1s ease-in-out infinite;
    }

    .dot:nth-child(2) { animation-delay: 0.15s; }
    .dot:nth-child(3) { animation-delay: 0.3s; }

    @keyframes typing-bounce {
      0%, 100% { transform: translateY(0); opacity: 0.5; }
      50%       { transform: translateY(-3px); opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .dot { animation: none; opacity: 0.7; }
    }

    /* ─── empty state ────────────────────────────────── */
    .empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-8);
      text-align: center;
    }

    .empty-icon {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-xl);
      background: var(--color-neutral-100);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
    }

    :host-context(.dark) .empty-icon { background: var(--color-neutral-800); }

    .empty-text h3 {
      margin: 0 0 var(--space-1);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-secondary);
    }

    .empty-text p {
      margin: 0;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ─── thread ─────────────────────────────────────── */
    .thread {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--color-bg);
    }

    /* mobile-only; hidden on desktop */
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
      transition: background-color 0.15s ease;
      flex-shrink: 0;
    }

    .back-btn:hover { background: var(--color-neutral-100); }
    .back-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    :host-context(.dark) .back-btn:hover { background: var(--color-neutral-700); }

    .mobile-bar-name {
      flex: 1;
      min-width: 0;
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mobile-typing { margin-left: var(--space-1); }

    /* ─── feed ───────────────────────────────────────── */
    .feed {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: 2px;
      scrollbar-width: thin;
      scrollbar-color: var(--color-border) transparent;
    }

    .msg      { display: flex; margin-bottom: 1px; }
    .msg.tail { margin-bottom: var(--space-2); }

    .bubble {
      max-width: 65%;
      background: var(--color-neutral-100);
      border-radius: var(--radius-xl);
      padding: var(--space-2) var(--space-3);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    :host-context(.dark) .bubble { background: var(--color-neutral-700); }

    .msg:not(.tail) .bubble { border-bottom-left-radius: var(--radius-xs); }

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
      border-radius: var(--radius-md);
      display: block;
    }

    .bubble time {
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
      align-self: flex-end;
    }

    /* ─── compose ────────────────────────────────────── */
    .compose {
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--color-border);
      background: var(--color-card);
      flex-shrink: 0;
    }

    .compose-hint {
      height: 40px;
      padding: 0 var(--space-4);
      background: var(--color-neutral-100);
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      cursor: not-allowed;
    }

    :host-context(.dark) .compose-hint { background: var(--color-neutral-700); }

    .compose-hint span {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    /* ─── no-selection ───────────────────────────────── */
    .no-selection {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
    }

    .no-selection-icon {
      width: 72px;
      height: 72px;
      border-radius: var(--radius-2xl);
      background: var(--color-neutral-100);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-neutral-300);
    }

    :host-context(.dark) .no-selection-icon {
      background: var(--color-neutral-800);
      color: var(--color-neutral-600);
    }

    .no-selection-text { text-align: center; }

    .no-selection-text p {
      margin: 0 0 var(--space-1);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-secondary);
    }

    .no-selection-text span {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ─── mobile ─────────────────────────────────────── */
    @media (max-width: 640px) {
      .sidebar {
        position: absolute;
        inset: 0;
        width: 100%;
        z-index: 1;
        border-right: none;
        transition: opacity 0.15s ease, visibility 0.15s ease;
      }

      .sidebar.hidden {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }

      .thread {
        position: absolute;
        inset: 0;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.15s ease, visibility 0.15s ease;
      }

      .thread.open {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .mobile-bar { display: flex; }
    }
  `],
})
export class RtmPageComponent {
  protected readonly store    = inject(RtmStore);
  protected readonly imSocket = inject(ImSocketService);

  protected readonly searchQuery = signal('');

  protected readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.store.conversations();
    if (!q) return all;
    return all.filter(c =>
      c.nickname.toLowerCase().includes(q) || c.userId.includes(q),
    );
  });

  private readonly feedEl = viewChild<ElementRef<HTMLElement>>('feed');

  constructor() {
    effect(() => {
      const conv = this.store.selected();
      if (!conv) return;
      conv.messages.length;
      const el = this.feedEl()?.nativeElement;
      if (el) Promise.resolve().then(() => { el.scrollTop = el.scrollHeight; });
    });
  }

  protected isLastInGroup(messages: readonly DmMessage[], i: number): boolean {
    const next = messages[i + 1];
    const cur  = messages[i];
    return !next || next.type !== cur?.type;
  }

  protected preview(conv: DmConversation): string {
    const last = conv.messages.at(-1);
    if (!last) return '';
    switch (last.type) {
      case 'text':         return last.text ?? '';
      case 'image':        return 'Photo';
      case 'gift':         return `Gift ×${last.count ?? 1}`;
      case 'introduction': return 'Introduction';
    }
  }

  protected fmtTime(ts: number): string {
    const d   = new Date(ts);
    const now = new Date();
    const today =
      d.getDate()     === now.getDate()  &&
      d.getMonth()    === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    return today
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
