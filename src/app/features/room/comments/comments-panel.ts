import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { Tabs, TabList, Tab, TabPanel, TabContent } from '@angular/aria/tabs';
import { CommentListComponent } from './comment-list';
import { CommentInputComponent, ReplyTarget, SendEvent } from './comment-input';
import { CaptionListComponent } from './caption-list';
import { Comment } from '../models/room-model';
import { COMMENTS_READER } from './comments-store';
import { LucideMessageCircle, LucideCaptions, LucideMaximize2, LucideMinimize2, LucideRefreshCw } from '@lucide/angular';

@Component({
  selector: 'app-comments-panel',
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    CommentListComponent,
    CommentInputComponent,
    CaptionListComponent,
    LucideMessageCircle,
    LucideCaptions,
    LucideMaximize2,
    LucideMinimize2,
    LucideRefreshCw,
  ],
  host: {
    '[class.expanded]': 'expanded()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="comments-panel" ngTabs>
      <div class="panel-header">
        <div class="header-left">
          <ul
            ngTabList
            class="tabs"
            [(selectedTab)]="activeTab"
            (selectedTabChange)="onTabChange($event)"
          >
            <li ngTab value="comments" class="tab-btn">
              <svg aria-hidden="true" lucideMessageCircle [size]="13" />
              <span>Comments</span>
            </li>
            <li ngTab value="captions" class="tab-btn">
              <svg aria-hidden="true" lucideCaptions [size]="13" />
              <span>Captions</span>
            </li>
          </ul>
        </div>
        <div class="header-actions">
          <button
            class="icon-btn"
            [disabled]="refreshing()"
            (click)="onRefresh()"
            aria-label="Refresh"
          >
            <svg aria-hidden="true" lucideRefreshCw [size]="13" [class.spinning]="refreshing()" />
          </button>
          <button
            class="icon-btn expand-btn"
            (click)="toggleExpanded()"
            [attr.aria-label]="expanded() ? 'Collapse comments' : 'Expand comments'"
          >
            @if (expanded()) {
              <svg aria-hidden="true" lucideMinimize2 [size]="13" />
            } @else {
              <svg aria-hidden="true" lucideMaximize2 [size]="13" />
            }
          </button>
        </div>
      </div>

      <div ngTabPanel value="comments" class="tab-panel">
        <ng-template ngTabContent>
          <div class="comments-scroll">
            <app-comment-list
              #commentListEl
              [items]="commentsStore.mergedItems()"
              [currentUserId]="currentUserId()"
              [replyDisabled]="disabled()"
              (reply)="onReply($event)"
            />

            @if (typingText(); as label) {
              <div class="typing-indicator" aria-live="polite">
                <span class="typing-dots" aria-hidden="true">
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                </span>
                <span class="typing-text">{{ label }}</span>
              </div>
            }
          </div>

          <app-comment-input
            [replyTo]="replyTo()"
            [disabled]="disabled()"
            (send)="onSendComment($event)"
            (typing)="typing.emit()"
            (cancelReply)="replyTarget.set(null)"
          />

          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {{ unreadAnnouncement() }}
          </div>
        </ng-template>
      </div>
      <div ngTabPanel value="captions" class="tab-panel">
        <ng-template ngTabContent>
          <app-caption-list [captions]="captions()" />
        </ng-template>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        container-type: inline-size;
        container-name: comments-panel;

        --cp-bg: var(--color-card);
        --cp-border: var(--color-border);
        --cp-tab-bg: var(--color-neutral-100);
        --cp-tab-txt: var(--color-text-muted);
        --cp-tab-active-bg: var(--color-card);
        --cp-tab-active-txt: var(--color-primary-600);
        --cp-icon: var(--color-text-muted);
      }
      :host-context(.dark) {
        --cp-bg: var(--color-neutral-800);
        --cp-border: var(--color-neutral-700);
        --cp-tab-bg: var(--color-neutral-800);
        --cp-tab-txt: var(--color-neutral-400);
        --cp-tab-active-bg: var(--color-neutral-700);
        --cp-tab-active-txt: var(--color-primary-300);
        --cp-icon: var(--color-neutral-400);
      }

      :host.expanded {
        position: fixed;
        inset: 0;
        z-index: var(--z-modal);
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        animation: panel-expand 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes panel-expand {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }

      .comments-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--cp-bg);
        /* Mobile: top border separates the chat zone from the audience strip.
           Desktop restores border-left via the container query below. */
        border-top: 1px solid var(--cp-border);
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-2) var(--space-3);
        border-bottom: 1px solid var(--cp-border);
        flex-shrink: 0;
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-width: 0;
      }
      .tabs {
        display: flex;
        gap: 2px;
        padding: 2px;
        margin: 0;
        list-style: none;
        border-radius: var(--radius-md);
        background: var(--cp-tab-bg);
      }
      .tab-btn {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: 3px var(--space-2);
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--cp-tab-txt);
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        cursor: pointer;
        white-space: nowrap;
      }
      .tab-btn[aria-selected='true'] {
        background: var(--cp-tab-active-bg);
        color: var(--cp-tab-active-txt);
      }
      .tab-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }
      .icon-btn {
        width: var(--icon-btn-size);
        height: var(--icon-btn-size);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--cp-icon);
      }
      .icon-btn:disabled { cursor: default; opacity: 0.6; }
      .icon-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }
      /* Apple HIG 44pt minimum touch target — 28px (--icon-btn-size) is fine
         for desktop but fails HIG on mobile. The button stays visually 28px
         (no padding change), but its hit area is 44px via padding + a
         negative margin so the layout doesn't shift. */
      @media (max-width: 1023.98px) {
        .icon-btn {
          min-width: var(--touch-target-min);
          min-height: var(--touch-target-min);
          /* The button is centered inside its hit box via flex (display:flex
             above). Width/height stay at --icon-btn-size; the min-* pair
             grows the hit box outward in both axes. */
        }
        .icon-btn:active:not(:disabled) {
          background: var(--color-neutral-100);
          transform: scale(0.92);
        }
      }
      .expand-btn { display: none; }

      .spinning { animation: spin 0.8s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        .spinning { animation-duration: 0.01ms; animation-iteration-count: 1; }
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Container query: comments-panel sits in a column that may be the
         mobile bottom slot or the desktop sidebar; expand affordance only
         makes sense when the panel is in the mobile slot. */
      @container room-page (max-width: 1023.98px) and (min-height: 500px) {
        .expand-btn { display: flex; }
        /* Account for the position:fixed comment-input bar so the last
           messages are not hidden behind it. The padding shrinks the
           flex:1 app-comment-list by this amount, keeping content above
           the pinned input. Matches the input bar's approximate height
           (40px buttons + 8px top padding + 8px bottom padding) plus
           env() for the home indicator on iOS. */
        .comments-scroll {
          padding-bottom: calc(var(--mobile-input-height) + var(--shell-inset-bottom));
        }
      }

      /* Desktop two-column layout: switch from top border to left border. */
      @container room-page (min-width: 1024px) and (min-height: 500px) {
        .comments-panel {
          border-top: none;
          border-left: 1px solid var(--cp-border);
        }
      }

      .tab-panel {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        position: relative;
      }
      .tab-panel[inert] { display: none; }
      .comments-scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }
      app-comment-input { flex-shrink: 0; }

      .typing-indicator {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: 2px var(--space-3) var(--space-1);
        font-size: var(--text-2xs);
        color: var(--cp-icon);
        flex-shrink: 0;
      }
      .typing-dots {
        display: inline-flex;
        gap: 2px;
        align-items: center;
      }
      .typing-dot {
        width: var(--space-1);
        height: var(--space-1);
        border-radius: 50%;
        background: var(--color-primary-500);
        opacity: 0.5;
      }
      :host-context(.dark) .typing-dot {
        background: var(--color-primary-300);
      }

      @media (prefers-reduced-motion: reduce) {
        :host.expanded { animation: none; }
        .spinning { animation: none; }
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
})
export class CommentsPanelComponent {
  readonly commentsStore = inject(COMMENTS_READER);

  readonly comments = input<readonly Comment[]>([]);
  readonly captions = input<readonly import('../models/room-model').CaptionEntry[]>([]);
  readonly currentUserId = input<number>(0);
  readonly refreshing = input(false);
  readonly typingNames = input<readonly string[]>([]);
  /** When true, the comment input is disabled and inline reply buttons are hidden. */
  readonly disabled = input(false);
  readonly sendComment = output<SendEvent>();
  readonly refresh = output<void>();
  readonly loadCaptions = output<void>();
  readonly typing = output<void>();

  readonly activeTab = signal<string | undefined>('comments');
  readonly replyTarget = signal<Comment | null>(null);
  readonly expanded = signal(false);

  readonly replyTo = computed<ReplyTarget | null>(() => {
    const comment = this.replyTarget();
    return comment
      ? {
          msgId: comment._id,
          fromId: comment.userId,
          nickname: comment.nickname,
          text: comment.msg.text.text,
        }
      : null;
  });

  readonly typingText = computed<string | null>(() => {
    const names = this.typingNames();
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is writing...`;
    if (names.length === 2) return `${names[0]} & ${names[1]} are writing...`;
    return 'Several people are writing...';
  });

  /**
   * SR-only announcement for unread-count transitions. Reads the store's
   * unread count and only emits a new label when the count changes —
   * TalkBack/VoiceOver hear "5 new messages" once per transition instead
   * of every individual comment text.
   */
  private readonly _announcement = signal('');
  protected readonly unreadAnnouncement = this._announcement.asReadonly();

  constructor() {
    effect(() => {
      const count = this.commentsStore.unreadCount();
      if (count === 0) {
        // Only emit "No new messages" when transitioning away from > 0.
        if (this._announcement() !== '') this._announcement.set('No new messages');
      } else if (count === 1) {
        this._announcement.set('1 new message');
      } else {
        this._announcement.set(`${count} new messages`);
      }
    });
  }

  onTabChange(tab: string | undefined): void {
    if (tab === 'captions') {
      this.loadCaptions.emit();
    }
  }

  onReply(comment: Comment): void {
    this.replyTarget.set(comment);
  }

  onSendComment(event: SendEvent): void {
    this.sendComment.emit(event);
    this.replyTarget.set(null);
  }

  onRefresh(): void {
    this.refresh.emit();
  }

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
  }
}
