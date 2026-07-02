import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
} from '@angular/core';
import { Tabs, TabList, Tab, TabPanel, TabContent } from '@angular/aria/tabs';
import { CommentListComponent } from './comment-list';
import { CommentInputComponent, ReplyTarget, SendEvent } from './comment-input';
import { CaptionListComponent } from './caption-list';
import { Comment } from '../../data/room-model';
import { CommentsStore } from './comments-store';
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
            (send)="onSendComment($event)"
            (typing)="typing.emit()"
            (cancelReply)="replyTarget.set(null)"
          />
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
        border-left: 1px solid var(--cp-border);
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
      .expand-btn { display: none; }

      .spinning { animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Container query: comments-panel sits in a column that may be the
         mobile bottom slot or the desktop sidebar; expand affordance only
         makes sense when the panel is in the mobile slot. */
      @container comments-panel (max-width: 1023.98px) {
        .expand-btn { display: flex; }
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
    `,
  ],
})
export class CommentsPanelComponent {
  readonly commentsStore = inject(CommentsStore);

  readonly comments = input<readonly Comment[]>([]);
  readonly captions = input<readonly import('../../data/room-model').CaptionEntry[]>([]);
  readonly currentUserId = input<number>(0);
  readonly refreshing = input(false);
  readonly typingNames = input<readonly string[]>([]);
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
