import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
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
import { Comment, CommentOrEvent } from '../models/room-model';
import { EventCardComponent } from '../ui/event-card';
import { COMMENTS_READER, COMMENTS_WRITER } from './comments-store';
import {
  LucideArrowDown,
  LucideCopy,
  LucideCheck,
  LucideCornerUpLeft,
  LucideCrown,
  LucideHeart,
} from '@lucide/angular';
import {
  CommentGroup,
  Row,
  ReplyInfo,
  nameColorIndex,
  formatTime,
  findReplyTarget,
  rowKey,
  buildRows,
} from './comment-list.util';

// Token values, not hex literals — these already adapt correctly under the dark theme
// via CSS custom property overrides (see CLAUDE.md §16), so no separate dark-mode array
// is needed.
const NAME_COLORS_LIGHT = [
  'var(--color-primary-600)',
  'var(--color-accent-600)',
  'var(--color-warm-600)',
  'var(--color-gold-600)',
  'var(--color-social-600)',
  'var(--color-berry-600)',
];

/**
 * Floating "X new messages ↓" pill anchored at the bottom of the comment-list
 * scroll container. Click bubbles up to the parent (no output indirection).
 * Inline here per CLAUDE.md §6 — a small dumb component that depends on
 * feature-specific state belongs next to its parent.
 */
@Component({
  selector: 'app-new-messages-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideArrowDown],
  template: `
    <button
      type="button"
      class="new-messages-pill"
      [attr.aria-label]="ariaLabel()"
    >
      <span class="pill-text">{{ count() }} new {{ count() === 1 ? 'message' : 'messages' }}</span>
      <svg aria-hidden="true" lucideArrowDown [size]="14"></svg>
    </button>
  `,
  styles: [`
    :host {
      position: sticky;
      bottom: var(--space-2);
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: 1;
    }
    /* Mobile: lift the pill a touch so it clears the last comment row on
       cramped voice-room list heights (22cqh) and adds safe-area padding
       above the iOS home indicator. */
    @container room-page (max-width: 1023.98px) and (min-height: 500px) {
      :host {
        bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
      }
    }
    .new-messages-pill {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 6px 12px;
      border-radius: var(--radius-full);
      border: none;
      background: var(--color-primary-500);
      color: var(--color-on-color);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      cursor: pointer;
      box-shadow: var(--shadow-md);
    }
    :host-context(.dark) .new-messages-pill { background: var(--color-primary-600); }

    /* Single block gates both entrance animation AND interactive transitions
       behind the same reduced-motion preference — keeps the rules together. */
    @media (prefers-reduced-motion: no-preference) {
      .new-messages-pill {
        transition: transform 0.15s ease, background-color 0.15s ease;
        animation: pill-enter 0.2s ease-out;
      }
      @keyframes pill-enter {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    }

    .new-messages-pill:hover { background: var(--color-primary-600); }
    :host-context(.dark) .new-messages-pill:hover { background: var(--color-primary-700); }
    .new-messages-pill:active { transform: scale(0.96); }
    .new-messages-pill:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }

    .pill-text { white-space: nowrap; }
  `],
})
export class NewMessagesPillComponent {
  readonly count = input.required<number>();
  readonly ariaLabel = computed(() =>
    this.count() === 1
      ? 'Scroll to newest message'
      : `Scroll to newest messages, ${this.count()} new`,
  );
}

@Component({
  selector: 'app-comment-list',
  imports: [
    AvatarComponent,
    CountryFlagComponent,
    NgOptimizedImage,
    EventCardComponent,
    NewMessagesPillComponent,
    LucideCopy,
    LucideCheck,
    LucideCornerUpLeft,
    LucideCrown,
    LucideHeart,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="comment-list" role="log" aria-label="Comments" #scrollContainer>
      @if (unreadCount() > 0 && !isAtBottom()) {
        <app-new-messages-pill
          [count]="unreadCount()"
          (click)="onNewMessagesPillClick()"
        />
      }
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

                  <span class="time">{{ formatTime(row.group.createdAtMs) }}</span>
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
                          class="action-btn action-reply"
                          [class.is-hidden]="replyDisabled()"
                          (click)="onReply(comment)"
                          [disabled]="replyDisabled()"
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
        /* Bottom padding matches the fixed comment-input's total height
           (visible content + iOS home-indicator safe-area). The input host
           is pinned to bottom:0 and pushes its inner content above the
           home indicator via padding-bottom on .comment-input-wrapper, so
           the visible content of the bar is ~59px but its full box height
           is 59px + env(safe-area-inset-bottom). Reserve that height here
           so the last comment can scroll fully into view above the bar.
           Without the safe-area term, the last message disappears under
           the home indicator on iPhones that report inset-bottom > 0. */
        padding-bottom: calc(64px + var(--space-3) + env(safe-area-inset-bottom, 0px));
        overflow-y: auto;
        /* Stop iOS rubber-band from chaining through to the parent once the
           list itself is scrolled to either end. Without this, scrolling
           past the oldest comment drags the page (.app-main) behind it. */
        overscroll-behavior: contain;
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
      /* When reply is disabled (e.g. user is invisible), hide the inline
         reply button entirely — the .is-hidden class is applied via the
         replyDisabled() input. */
      .action-btn.is-hidden { display: none; }

      @container room-page (max-width: 1023.98px) and (min-height: 500px) {
        /* WCAG 2.5.5 AAA — primary interactive controls must hit 44×44. The
           visual size stays compact so the layout doesn't reflow; the hit area
           grows outward without changing the rendered icon. */
        .action-btn {
          min-width: 44px;
          min-height: 44px;
        }

        /* The "X new messages ↓" pill is the user's only backlog signal while
           scrolled up; under-sized touch targets miss-thumb into adjacent
           comments. Same hit-area growth trick. */
        .new-messages-pill {
          min-height: 44px;
        }

        /* Jump-to-original quote — short quoted messages ("ok", "yes") render
           smaller than the AAA target. Set a min-height so even a one-word quote
           is reachable. */
        .reply-quote {
          min-height: 44px;
        }
      }

      /* ─── Empty state ─── */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        /* flex: 1 makes the empty-state consume the remaining column height so
           justify-content: center actually centers vertically. Without it,
           the empty-state is a regular flex-column item with intrinsic height
           and sits at the top of the column. */
        flex: 1;
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
  readonly replyDisabled = input(false);
  readonly reply = output<Comment>();
  readonly UserRole = UserRole;

  readonly copiedId = signal<string | null>(null);
  readonly highlightId = signal<string | null>(null);
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  private readonly commentsReader = inject(COMMENTS_READER);
  private readonly commentsWriter = inject(COMMENTS_WRITER);

  private readonly plainComments = computed<readonly Comment[]>(() =>
    this.items().filter((i): i is Comment => !('kind' in i)),
  );

  readonly rows = computed<readonly Row[]>(() => buildRows(this.items()));
  readonly rowKey = rowKey;

  /** "X new messages" pill count, derived from the store's lastReadTs.
   *  Counts Comment items newer than the last-read timestamp; EventCards
   *  (gifts, joins, follows) are intentionally excluded — the pill is about
   *  new conversation, not new events about people. */
  readonly unreadCount = computed<number>(() => {
    const list = this.items();
    const since = this.commentsReader.lastReadTs();
    let n = 0;
    for (const item of list) {
      if ('kind' in item) continue;
      if (item.createdAtMs > since) n++;
    }
    return n;
  });

  /** True when the user is within a few pixels of the scroll container's
   *  bottom — i.e. they've caught up to the latest comment. Updated by the
   *  scroll listener registered in `registerScrollListener()`. Used to decide
   *  whether new comments auto-scroll (at-bottom) or accumulate behind the
   *  pill (scrolled up). Starts `false` so the first scroll event (whichever
   *  side it lands on) is the source of truth, not the pre-mount default. */
  readonly isAtBottom = signal(false);

  /** Tracks whether the initial bottom-scroll has happened — runs once when
   *  items first arrive (the history fetch may complete after the component
   *  mounts, so we can't rely on ngAfterViewInit alone). */
  private hasAutoScrolledToBottom = false;

  /** Guards `registerScrollListener()` from being called twice — the
   *  scrollContainer() signal can change reference identity in dev/HMR even
   *  though the underlying element is stable, and we want exactly one listener. */
  private scrollListenerRegistered = false;

  /** Scrolls the container to the very bottom. Uses `requestAnimationFrame`
   *  so any pending DOM mutation (new comment bubble just rendered) is in
   *  the layout before we measure scrollHeight. After the programmatic
   *  scroll, force `isAtBottom = true` — browsers don't reliably fire a
   *  `scroll` event for programmatic scrollTo, so without this the
   *  at-bottom effect can't detect that we're now at the bottom and would
   *  keep the pill visible on every new comment. */
  private scrollToBottom(): void {
    const container = this.scrollContainer()?.nativeElement;
    if (!container) return;
    requestAnimationFrame(() => {
      const el = this.scrollContainer()?.nativeElement;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      this.isAtBottom.set(true);
    });
  }

  /** Throttled scroll listener — recomputes `isAtBottom` on every scroll event
   *  using a 4px tolerance to absorb subpixel rounding and animation in flight. */
  private registerScrollListener(): void {
    if (this.scrollListenerRegistered) return;
    const container = this.scrollContainer();
    if (!container) return;
    const el = container.nativeElement;
    const handler = () => {
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      this.isAtBottom.set(distanceFromBottom <= 4);
    };
    el.addEventListener('scroll', handler, { passive: true });
    this.destroyRef.onDestroy(() => el.removeEventListener('scroll', handler));
    this.scrollListenerRegistered = true;
  }

  onNewMessagesPillClick(): void {
    this.scrollToBottom();
    this.commentsWriter.resetUnread();
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
      if (this.highlightTimer) clearTimeout(this.highlightTimer);
    });

    // First non-empty `items()` → scroll to bottom once. Fires when the
    // history fetch lands, not just at mount — history may complete async.
    effect(() => {
      if (this.hasAutoScrolledToBottom) return;
      if (this.items().length === 0) return;
      this.hasAutoScrolledToBottom = true;
      this.scrollToBottom();
    });

    // While at the bottom, new comments auto-scroll into view silently —
    // no pill flash, no user action needed. Only when the user has scrolled
    // up does the pill count accumulate.
    effect(() => {
      if (this.unreadCount() > 0 && this.isAtBottom()) {
        this.scrollToBottom();
        this.commentsWriter.resetUnread();
      }
    });

    // Register the scroll listener once the viewChild resolves. Wrapped in
    // an effect rather than ngAfterViewInit so it re-tries if the element
    // becomes available later (e.g. inside a @if).
    effect(() => {
      if (this.scrollContainer()) {
        this.registerScrollListener();
      }
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
