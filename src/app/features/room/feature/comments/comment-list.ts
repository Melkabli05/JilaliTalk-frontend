import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  DestroyRef,
  viewChild,
  ElementRef,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { UserRole } from '@core/models/user-role';
import { Comment, CommentOrEvent, EventCard } from '../../data/room-model';
import { EventCardComponent } from '../../ui/event-card';
import { formatClockTime } from '@shared/utils';
import {
  LucideCopy,
  LucideCheck,
  LucideCornerUpLeft,
  LucideCrown,
  LucideHeart,
} from '@lucide/angular';

interface CommentGroup {
  key: string;
  userId: number;
  nickname: string;
  headUrl: string | null;
  nationality: string | null;
  role: UserRole;
  vipType: number;
  fgLevel: number;
  fgName: string | null;
  fgIsActive: boolean;
  createdAt: number;
  messages: readonly Comment[];
}

const GROUP_WINDOW_MS = 60_000;
const NAME_COLOR_COUNT = 6;

const NAME_COLORS_LIGHT = [
  'var(--color-primary-600)',
  'var(--color-accent-600)',
  'var(--color-warm-600)',
  'var(--color-gold-600)',
  'var(--color-social-600)',
  'var(--color-berry-600)',
];
const NAME_COLORS_DARK = [
  'var(--color-primary-300)',
  'var(--color-accent-300)',
  'var(--color-warm-300)',
  'var(--color-gold-300)',
  'var(--color-social-300)',
  'var(--color-berry-300)',
];

function nameColorIndex(userId: number): number {
  return userId % NAME_COLOR_COUNT;
}

const formatTime = formatClockTime;

function formatDateLabel(timestamp: number): string {
  const now = new Date();
  const msg = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(msg.getFullYear(), msg.getMonth(), msg.getDate());
  const diff = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return msg.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

type ReplyInfo = NonNullable<Comment['msg']['replyInfo']>;

function findReplyTarget(
  comments: readonly Comment[],
  comment: Comment,
  ri: ReplyInfo,
): Comment | null {
  if (ri.msgId) {
    return comments.find((c) => c._id === ri.msgId) ?? null;
  }
  let best: Comment | null = null;
  for (const c of comments) {
    if (c._id === comment._id) break;
    if (c.userId === ri.fromId && c.msg.text.text === ri.text) best = c;
  }
  return best;
}

function buildGroups(comments: readonly Comment[]): (CommentGroup & { dateLabel?: string })[] {
  const out: (CommentGroup & { dateLabel?: string })[] = [];
  let lastDate: string | null = null;

  for (const c of comments) {
    const dateLabel = formatDateLabel(c.createdAt);
    const last = out[out.length - 1];
    const sameGroup =
      last &&
      last.userId === c.userId &&
      c.createdAt - last.createdAt <= GROUP_WINDOW_MS &&
      dateLabel === lastDate;

    if (!sameGroup) {
      const entry: CommentGroup & { dateLabel?: string } = {
        key: c._id,
        userId: c.userId,
        nickname: c.nickname,
        headUrl: c.headUrl,
        nationality: c.nationality,
        role: c.role,
        vipType: c.vipType,
        fgLevel: c.fgLevel,
        fgName: c.fgName,
        fgIsActive: c.fgIsActive,
        createdAt: c.createdAt,
        messages: [c],
      };
      if (dateLabel !== lastDate) {
        entry.dateLabel = dateLabel;
        lastDate = dateLabel;
      }
      out.push(entry);
    } else {
      (last!.messages as Comment[]).push(c);
    }
  }
  return out;
}

type CommentRow = {
  readonly type: 'comments';
  readonly group: CommentGroup & { dateLabel?: string };
  readonly ts: number;
};
type EventRow = { readonly type: 'event'; readonly card: EventCard; readonly ts: number };
type Row = CommentRow | EventRow;

function rowKey(row: Row): string {
  if (row.type === 'comments') return row.group.key;
  return row.card.kind === 'gift' ? `${row.card.id}-${row.card.giftCount}` : row.card.id;
}

function buildRows(items: readonly CommentOrEvent[]): readonly Row[] {
  const comments = items.filter((i): i is Comment => !('kind' in i));
  const events = items.filter((i): i is EventCard => 'kind' in i);

  const commentRows: readonly CommentRow[] = buildGroups(comments).map((group) => ({
    type: 'comments' as const,
    group,
    ts: group.createdAt,
  }));
  const eventRows: readonly EventRow[] = events.map((card) => ({
    type: 'event' as const,
    card,
    ts: card.ts,
  }));

  return [...commentRows, ...eventRows].sort((a, b) => a.ts - b.ts);
}

@Component({
  selector: 'app-comment-list',
  imports: [
    AvatarComponent,
    CountryFlagComponent,
    NgOptimizedImage,
    EventCardComponent,
    LucideCopy,
    LucideCheck,
    LucideCornerUpLeft,
    LucideCrown,
    LucideHeart,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="comment-list" role="log" aria-live="polite" aria-label="Comments" #scrollContainer>
      @for (row of rows(); track rowKey(row)) {
        @switch (row.type) {
          @case ('comments') {
            @if (row.group.dateLabel; as label) {
              <div class="date-sep">
                <div class="date-sep__line"></div>
                <span class="date-sep__label">{{ label }}</span>
                <div class="date-sep__line"></div>
              </div>
            }

            <div class="group">
              <app-avatar
                class="group-avatar"
                [src]="row.group.headUrl || ''"
                [initials]="row.group.nickname.slice(0, 2)"
                size="sm"
                [alt]="row.group.nickname"
              />

              <div class="group-body">
                <div class="group-meta">
                  <span class="name" [style.--name-color]="nameColor(row.group)">{{
                    row.group.nickname
                  }}</span>

                  @if (row.group.nationality) {
                    <app-country-flag [code]="row.group.nationality" [compact]="true" />
                  }

                  @if (row.group.role === UserRole.Host) {
                    <span class="role-badge host">Host</span>
                  } @else if (row.group.role === UserRole.Moderator) {
                    <span class="role-badge mod">Mod</span>
                  }

                  @if (row.group.vipType === 100) {
                    <span class="vip-chip vip-gold"
                      ><svg aria-hidden="true" lucideCrown [size]="9" />VIP</span
                    >
                  } @else if (row.group.vipType > 0) {
                    <span class="vip-chip vip-primary"
                      ><svg aria-hidden="true" lucideCrown [size]="9" />VIP</span
                    >
                  }

                  @if (row.group.fgIsActive && row.group.fgName) {
                    <span class="fg-chip">
                      <svg aria-hidden="true" lucideHeart [size]="9" />{{ row.group.fgName }}
                      {{ row.group.fgLevel }}
                    </span>
                  }

                  <span class="time">{{ formatTime(row.group.createdAt) }}</span>
                </div>

                @for (comment of row.group.messages; track comment._id) {
                  <div
                    class="message"
                    [class.own]="isSelfGroup(row.group)"
                    [class.highlighted]="highlightId() === comment._id"
                    [attr.data-comment-id]="comment._id"
                  >
                    @if (comment.msg.replyInfo; as ri) {
                      <div
                        class="reply-quote"
                        [class.own]="isSelfGroup(row.group)"
                        role="button"
                        tabindex="0"
                        [attr.aria-label]="'Jump to original message from ' + ri.fromNickname"
                        (click)="onReplyQuoteClick(comment, ri)"
                        (keydown.enter)="onReplyQuoteClick(comment, ri)"
                        (keydown.space)="onReplyQuoteClick(comment, ri); $event.preventDefault()"
                      >
                        <span class="reply-quote__label">
                          <svg aria-hidden="true" lucideCornerUpLeft [size]="10" />
                          Replying to <strong>{{ ri.fromNickname }}</strong>
                        </span>
                        <span class="reply-quote__text">{{ ri.text }}</span>
                      </div>
                    }
                    <div
                      class="bubble"
                      [class.own]="isSelfGroup(row.group)"
                      [class.skinned]="hasBubbleSkin(comment)"
                    >
                      {{ comment.msg.text.text }}
                      @if (hasAnimalBadge(comment)) {
                        <img
                          class="bubble-animal"
                          [ngSrc]="comment.bubbleAnimalUrl!"
                          width="18"
                          height="18"
                          alt=""
                          aria-hidden="true"
                        />
                      }
                      <span class="actions">
                        <button
                          type="button"
                          class="action-btn"
                          (click)="copyText(comment.msg.text.text, comment._id)"
                          [attr.aria-label]="copiedId() === comment._id ? 'Copied' : 'Copy'"
                        >
                          @if (copiedId() === comment._id) {
                            <svg aria-hidden="true" lucideCheck [size]="11" />
                          } @else {
                            <svg aria-hidden="true" lucideCopy [size]="11" />
                          }
                        </button>
                        <button
                          type="button"
                          class="action-btn"
                          (click)="onReply(comment)"
                          aria-label="Reply"
                        >
                          <svg aria-hidden="true" lucideCornerUpLeft [size]="11" />
                        </button>
                      </span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          @case ('event') {
            <app-event-card [card]="row.card" />
          }
        }
      }

      @if (rows().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p class="empty-title">Nothing here yet</p>
          <p class="empty-sub">Say something</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;

        /* ─── Design tokens ─── */
        --cl-bg: var(--color-neutral-50);
        --cl-border: var(--color-border);
        --cl-text: var(--color-text);
        --cl-muted: var(--color-text-muted);
        --cl-name: var(--color-text);
        --cl-scroll: var(--color-neutral-300);
        --cl-msg-bg: transparent;
        --cl-sep-bg: var(--color-neutral-50);
        --cl-sep-txt: var(--color-text-muted);
        --cl-sep-line: var(--color-border);
        --cl-tag-bg: var(--color-neutral-100);
        --cl-tag-txt: var(--color-text-muted);
        --cl-action-bg: transparent;
        --cl-name-self: var(--color-primary-600);
        --cl-host-bg: color-mix(in srgb, var(--color-gold-500) 16%, transparent);
        --cl-host-fg: var(--color-gold-600);
        --cl-host-border: color-mix(in srgb, var(--color-gold-500) 40%, transparent);
        --cl-mod-bg: color-mix(in srgb, var(--color-primary-500) 14%, transparent);
        --cl-mod-fg: var(--color-primary-600);
        --cl-mod-border: color-mix(in srgb, var(--color-primary-500) 40%, transparent);
        --cl-vip-gold-bg: color-mix(in srgb, var(--color-gold-200) 60%, transparent);
        --cl-vip-gold-fg: var(--color-gold-700);
        --cl-vip-gold-border: color-mix(in srgb, var(--color-gold-500) 35%, transparent);
        --cl-vip-primary-bg: var(--color-primary-50);
        --cl-vip-primary-fg: var(--color-primary-600);
        --cl-vip-primary-border: color-mix(in srgb, var(--color-primary-500) 30%, transparent);
        --cl-fg-bg: color-mix(in srgb, var(--color-accent-500) 12%, transparent);
        --cl-fg-fg: var(--color-accent-600);
        --cl-fg-border: color-mix(in srgb, var(--color-accent-500) 30%, transparent);
        --cl-quote-fg: var(--color-primary-600);
        --cl-quote-text: var(--cl-muted);
        --cl-empty-bg: var(--color-primary-50);
        --cl-empty-fg: var(--color-primary-400);
      }
      :host-context(.dark) {
        --cl-bg: var(--color-neutral-800);
        --cl-border: var(--color-neutral-700);
        --cl-text: var(--color-neutral-100);
        --cl-muted: var(--color-neutral-500);
        --cl-name: var(--color-neutral-200);
        --cl-scroll: var(--color-neutral-600);
        --cl-sep-bg: var(--color-neutral-800);
        --cl-sep-txt: var(--color-neutral-400);
        --cl-sep-line: var(--color-neutral-700);
        --cl-tag-bg: color-mix(in srgb, var(--color-neutral-700) 70%, transparent);
        --cl-tag-txt: var(--color-neutral-400);
        --cl-name-self: var(--color-primary-300);
        --cl-host-bg: color-mix(in srgb, var(--color-gold-500) 24%, transparent);
        --cl-host-fg: var(--color-gold-300);
        --cl-host-border: color-mix(in srgb, var(--color-gold-500) 45%, transparent);
        --cl-mod-bg: color-mix(in srgb, var(--color-primary-500) 24%, transparent);
        --cl-mod-fg: var(--color-primary-300);
        --cl-mod-border: color-mix(in srgb, var(--color-primary-500) 45%, transparent);
        --cl-vip-gold-bg: color-mix(in srgb, var(--color-gold-500) 25%, transparent);
        --cl-vip-gold-fg: var(--color-gold-300);
        --cl-vip-gold-border: color-mix(in srgb, var(--color-gold-500) 45%, transparent);
        --cl-vip-primary-bg: color-mix(in srgb, var(--color-primary-500) 20%, transparent);
        --cl-vip-primary-fg: var(--color-primary-300);
        --cl-vip-primary-border: color-mix(in srgb, var(--color-primary-500) 45%, transparent);
        --cl-fg-bg: color-mix(in srgb, var(--color-accent-500) 22%, transparent);
        --cl-fg-fg: var(--color-accent-300);
        --cl-fg-border: color-mix(in srgb, var(--color-accent-500) 40%, transparent);
        --cl-quote-fg: var(--color-primary-300);
        --cl-quote-text: var(--color-neutral-400);
        --cl-empty-bg: var(--color-primary-900);
        --cl-empty-fg: var(--color-primary-300);
      }

      .comment-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-2);
        overflow-y: auto;
        flex: 1;
        scrollbar-width: thin;
        scrollbar-color: var(--cl-scroll) transparent;
      }
      .comment-list::-webkit-scrollbar { width: var(--space-1); }
      .comment-list::-webkit-scrollbar-thumb {
        background: var(--cl-scroll);
        border-radius: var(--radius-full);
      }

      /* ─── Date separator ─── */
      .date-sep {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) 0;
      }
      .date-sep__line {
        flex: 1;
        height: 1px;
        background: var(--cl-sep-line);
        opacity: 0.5;
      }
      .date-sep__label {
        font-size: var(--text-2xs);
        font-weight: var(--font-medium);
        color: var(--cl-sep-txt);
        padding: 1px var(--space-2);
        border-radius: var(--radius-full);
        background: var(--cl-sep-bg);
        white-space: nowrap;
      }

      /* ─── Comment group ─── */
      .group {
        display: flex;
        gap: var(--space-2);
        align-items: flex-start;
      }
      .group-avatar {
        flex-shrink: 0;
        margin-top: 2px;
      }
      .group-body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .group-meta {
        display: flex;
        align-items: baseline;
        gap: var(--space-1);
        margin-bottom: 2px;
        flex-wrap: wrap;
      }
      .name {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--name-color, var(--cl-name));
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 50%;
      }
      .name.is-self {
        color: var(--cl-name-self);
      }

      /* ─── Role / VIP / FG chips ─── */
      .role-badge {
        flex-shrink: 0;
        font-size: var(--text-2xs);
        font-weight: var(--font-bold);
        letter-spacing: 0.3px;
        text-transform: uppercase;
        padding: 1px 6px;
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
      }
      .role-badge.host {
        background: var(--cl-host-bg);
        color: var(--cl-host-fg);
        border-color: var(--cl-host-border);
      }
      .role-badge.mod {
        background: var(--cl-mod-bg);
        color: var(--cl-mod-fg);
        border-color: var(--cl-mod-border);
      }

      .vip-chip,
      .fg-chip {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
        font-size: var(--text-2xs);
        font-weight: var(--font-bold);
        letter-spacing: 0.2px;
        padding: 1px 6px;
        border-radius: var(--radius-sm);
        white-space: nowrap;
        border: 1px solid transparent;
      }
      .vip-chip.vip-gold {
        background: var(--cl-vip-gold-bg);
        color: var(--cl-vip-gold-fg);
        border-color: var(--cl-vip-gold-border);
      }
      .vip-chip.vip-primary {
        background: var(--cl-vip-primary-bg);
        color: var(--cl-vip-primary-fg);
        border-color: var(--cl-vip-primary-border);
      }
      .fg-chip {
        background: var(--cl-fg-bg);
        color: var(--cl-fg-fg);
        border-color: var(--cl-fg-border);
        text-transform: none;
      }

      .time {
        margin-left: auto;
        font-size: var(--text-2xs);
        color: var(--cl-muted);
        flex-shrink: 0;
      }

      /* ─── Message + bubble ─── */
      .message {
        position: relative;
        border-radius: var(--radius-md);
        padding: 1px var(--space-1) 1px 0;
        margin-right: calc(-1 * var(--space-1));
      }

      .bubble {
        font-size: var(--text-sm);
        color: var(--cl-text);
        line-height: 1.5;
        word-break: break-word;
        padding: 3px var(--space-2);
        border-radius: var(--radius-md);
        background: var(--cl-bg);
        display: inline-block;
        max-width: 100%;
      }
      .bubble.own {
        background: var(--color-primary-500);
        color: var(--color-on-color);
      }
      :host-context(.dark) .bubble.own {
        background: var(--color-primary-600);
        color: var(--color-on-color);
      }

      .bubble.skinned {
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center;
        color: var(--cl-text);
        padding-right: calc(var(--space-2) + 14px);
      }
      .bubble-animal {
        position: absolute;
        bottom: -4px;
        right: -4px;
        width: 18px;
        height: 18px;
        object-fit: contain;
        pointer-events: none;
      }

      /* ─── Reply quote ─── */
      .reply-quote {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 3px var(--space-2);
        margin-bottom: 3px;
        border-radius: var(--radius-sm) var(--radius-sm) 2px 2px;
        border-left: 3px solid var(--color-primary-400);
        background: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
        max-width: 92%;
        overflow: hidden;
        cursor: pointer;
      }
      .reply-quote:focus-visible {
        outline: var(--focus-ring);
        outline-offset: 1px;
      }
      .reply-quote.own {
        border-left-color: color-mix(in srgb, var(--color-on-color) 70%, transparent);
        background: color-mix(in srgb, var(--color-on-color) 18%, transparent);
      }
      .reply-quote__label {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: var(--text-2xs);
        font-weight: var(--font-medium);
        color: var(--cl-quote-fg);
      }
      .reply-quote__label strong {
        font-weight: var(--font-bold);
      }
      .reply-quote.own .reply-quote__label {
        color: var(--color-on-color);
      }
      .reply-quote__text {
        font-size: var(--text-2xs);
        font-style: italic;
        color: var(--cl-quote-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .reply-quote.own .reply-quote__text {
        color: color-mix(in srgb, var(--color-on-color) 75%, transparent);
      }

      /* ─── Actions (always visible, inline inside bubble) ─── */
      .actions {
        display: inline-flex;
        gap: 2px;
        margin-left: var(--space-1);
        vertical-align: middle;
      }

      .action-btn {
        width: 22px;
        height: 22px;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--cl-muted);
      }
      .action-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }

      /* ─── Empty state ─── */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-6) var(--space-4);
        text-align: center;
      }
      .empty-icon {
        width: 40px;
        height: 40px;
        border-radius: var(--radius-xl);
        background: var(--cl-empty-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--space-2);
        color: var(--cl-empty-fg);
      }
      .empty-title {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--cl-text);
        margin: 0 0 var(--space-1);
      }
      .empty-sub {
        font-size: var(--text-xs);
        color: var(--cl-muted);
        margin: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        /* No animations are used; nothing to disable here. Block reserved
           so future motion-adding edits are forced to opt-in. */
      }
    `,
  ],
})
export class CommentListComponent {
  readonly items = input<readonly CommentOrEvent[]>([]);
  readonly currentUserId = input<number>(0);
  readonly reply = output<Comment>();
  readonly UserRole = UserRole;

  readonly copiedId = signal<string | null>(null);
  readonly highlightId = signal<string | null>(null);
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly clipboard = inject(Clipboard);
  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  private readonly plainComments = computed<readonly Comment[]>(() =>
    this.items().filter((i): i is Comment => !('kind' in i)),
  );

  readonly rows = computed<readonly Row[]>(() => buildRows(this.items()));
  readonly rowKey = rowKey;

  /** True when the user is near the bottom of the scroll container. */
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      if (this.highlightTimer) clearTimeout(this.highlightTimer);
    });
  }

  isSelfGroup(group: CommentGroup): boolean {
    return group.userId === this.currentUserId();
  }

  nameColor(group: CommentGroup): string {
    if (this.isSelfGroup(group)) {
      return 'var(--color-primary-600)';
    }
    const idx = nameColorIndex(group.userId);
    return NAME_COLORS_LIGHT[idx] ?? 'var(--color-primary-600)';
  }

  hasBubbleSkin(comment: Comment): boolean {
    return comment.bubbleId >= 0 && !!comment.bubbleUrl;
  }

  hasAnimalBadge(comment: Comment): boolean {
    return this.hasBubbleSkin(comment) && comment.bubbleAnimalType > 0 && !!comment.bubbleAnimalUrl;
  }

  formatTime = formatTime;

  copyText(text: string, id: string): void {
    if (!this.clipboard.copy(text)) return;
    this.copiedId.set(id);
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    this.copyResetTimer = setTimeout(() => this.copiedId.set(null), 2000);
  }

  onReply(comment: Comment): void {
    this.reply.emit(comment);
  }

  onReplyQuoteClick(comment: Comment, ri: ReplyInfo): void {
    const target = findReplyTarget(this.plainComments(), comment, ri);
    if (!target) return;
    this.scrollToAndHighlight(target._id);
  }

  private scrollToAndHighlight(id: string): void {
    const container = this.scrollContainer()?.nativeElement;
    const target = container?.querySelector<HTMLElement>(`[data-comment-id="${id}"]`);
    if (!container || !target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightId.set(id);
    this.highlightTimer = setTimeout(() => this.highlightId.set(null), 1200);
  }
}
