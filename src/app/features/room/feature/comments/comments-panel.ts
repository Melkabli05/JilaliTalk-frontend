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
import { ToastService } from '@core/services/toast.service';
import { LucideMessageCircle, LucideCaptions, LucideX, LucideRefreshCw } from '@lucide/angular';

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
    LucideX,
    LucideRefreshCw,
  ],
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
          <button class="icon-btn" (click)="onClose()" aria-label="Close">
            <svg aria-hidden="true" lucideX [size]="14" />
          </button>
        </div>
      </div>

      <div ngTabPanel value="comments" class="tab-panel">
        <ng-template ngTabContent>
          <div class="comments-scroll">
            <app-comment-list
              [items]="commentsStore.mergedItems()"
              [currentUserId]="currentUserId()"
              [translations]="commentsStore.translations()"
              [translatingIds]="translatingIds()"
              (reply)="onReply($event)"
              (translate)="onTranslateComment($event)"
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
        width: 100% !important;
      }

      /* ─── Design tokens ─── */
      :host {
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

      .comments-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100% !important;
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
        width: 24px;
        height: 24px;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--cp-icon);
      }
      .icon-btn:disabled {
        cursor: default;
        opacity: 0.6;
      }
      .icon-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }
      .spinning {
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinning {
          animation: none;
        }
      }

      .tab-panel {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }
      .tab-panel[inert] {
        display: none;
      }
      .comments-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
      app-comment-input {
        flex-shrink: 0;
      }

      /* ─── Typing indicator ─── */
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
        width: 4px;
        height: 4px;
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
  private readonly toast = inject(ToastService);

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
  readonly translatingIds = computed(() => this.commentsStore.translatingIds());

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

  async onTranslateComment(event: { comment: Comment; text: string }): Promise<void> {
    await this.commentsStore.translateComment(event.comment._id, event.text, 'ar');
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

  onClose(): void {
    this.toast.info('Comments panel is open on desktop');
  }
}
