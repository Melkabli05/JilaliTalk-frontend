import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { EventCard } from '../data/room-model';
import { initialsFrom, formatClockTime } from '@shared/utils';
import {
  LucideFlower2, LucideArrowRight, LucideGem, LucideHeart,
  LucideLogIn, LucideLogOut, LucideHand, LucidePresentation, LucideShieldCheck, LucideShieldOff, LucideUserX,
} from '@lucide/angular';

@Component({
  selector: 'app-event-card',
  imports: [
    AvatarComponent, CountryFlagComponent,
    LucideFlower2, LucideArrowRight, LucideGem, LucideHeart,
    LucideLogIn, LucideLogOut, LucideHand, LucidePresentation, LucideShieldCheck, LucideShieldOff, LucideUserX,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let event = card();

    @if (event.kind === 'gift') {
      <div class="event-card gift">
        <div class="gift-icon-wrap">
          @if (giftIconUrl(event); as iconUrl) {
            <img class="gift-icon" [src]="iconUrl" alt="" />
          } @else {
            <span class="gift-icon gift-icon-fallback"><svg lucideFlower2 [size]="14" /></span>
          }
          @if (event.giftCount > 1) {
            <span class="combo-badge">×{{ event.giftCount }}</span>
          }
        </div>
        <div class="event-body">
          <div class="gift-sender">
            <app-avatar
              class="sender-avatar"
              [src]="avatarUrl(event)"
              [initials]="initials(event)"
              size="xs"
              [alt]="name(event)"
              [ringColor]="event.vipType === 100 ? 'var(--color-gold-400)' : event.vipType > 0 ? 'var(--color-primary-300)' : null"
            />
            <span class="event-nickname">{{ name(event) }}</span>
          </div>
          <svg class="gift-arrow" aria-hidden="true" lucideArrowRight [size]="10" />
          <app-avatar class="gift-receiver-avatar" [src]="event.receiverHeadUrl || ''" [initials]="giftReceiverInitials(event)" size="xs" [alt]="event.receiverNickname" />
          <span class="event-nickname receiver-name">{{ event.receiverNickname }}</span>
          <span class="gift-label">{{ giftLabel(event) }}</span>
          @if (event.coinAmount > 0) {
            <span class="coin-pill">
              <svg aria-hidden="true" lucideGem [size]="8" />
              {{ event.coinAmount * event.giftCount }}
            </span>
          }
        </div>
        <span class="event-time">{{ formatTime(event.ts) }}</span>
      </div>
    }
    @else if (event.kind === 'follow') {
      <div class="event-card follow" [class.mutual]="event.isFollowBack">
        <app-avatar class="event-avatar" [src]="avatarUrl(event)" [initials]="initials(event)" size="sm" />
        <div class="event-body">
          <span class="event-nickname">{{ name(event) }}</span>
          <span class="action-tag" [class.mutual-tag]="event.isFollowBack">
            @if (event.isFollowBack) {
              <svg aria-hidden="true" lucideHeart [size]="7" />
            }
            {{ tag(event) }}
          </span>
        </div>
        <span class="event-time">{{ formatTime(event.ts) }}</span>
      </div>
    }
    @else if (event.kind === 'stage_kick' || event.kind === 'room_kick') {
      <div class="event-card kick">
        <app-avatar class="event-avatar" [src]="avatarUrl(event)" [initials]="initials(event)" size="sm" />
        <div class="event-body">
          <span class="event-nickname">{{ name(event) }}</span>
          @if (event.nationality) {
            <app-country-flag [code]="event.nationality" [compact]="true" />
          }
          <span class="action-tag kick-tag">{{ tag(event) }}</span>
          <span class="kick-by">by {{ event.managerName }}</span>
        </div>
        <span class="event-time">{{ formatTime(event.ts) }}</span>
      </div>
    }
    @else if (event.kind === 'whiteboard_activated' || event.kind === 'whiteboard_deactivated') {
      <div class="event-card wb" [class.wb-active]="event.kind === 'whiteboard_activated'">
        <span class="wb-icon" [class.active]="event.kind === 'whiteboard_activated'" aria-hidden="true">
          <svg lucidePresentation [size]="13" />
          @if (event.kind === 'whiteboard_activated') {
            <span class="live-dot" aria-hidden="true"></span>
          }
        </span>
        <div class="event-body">
          <span class="action-tag wb-tag">{{ tag(event) }}</span>
        </div>
        <span class="event-time">{{ formatTime(event.ts) }}</span>
      </div>
    }
    @else {
      <div
        class="event-card note"
        [class]="'note-' + event.kind"
        [class.raised]="event.kind === 'stage_raisehand' && event.isRaised"
      >
        <div class="avatar-wrap">
          <app-avatar class="event-avatar" [src]="avatarUrl(event)" [initials]="initials(event)" size="sm" />
          <span class="icon-badge" [class]="'icon-badge-' + event.kind" aria-hidden="true">
            @switch (event.kind) {
              @case ('user_join') { <svg lucideLogIn [size]="7" /> }
              @case ('user_quit') { <svg lucideLogOut [size]="7" /> }
              @case ('stage_raisehand') { <svg lucideHand [size]="7" [class.rotated]="!event.isRaised" /> }
              @case ('mod_accepted') { <svg lucideShieldCheck [size]="7" /> }
              @case ('mod_removed') { <svg lucideShieldOff [size]="7" /> }
            }
          </span>
        </div>
        <div class="event-body">
          <span class="event-nickname">{{ name(event) }}</span>
          @if (nationality(event); as nat) {
            <app-country-flag [code]="nat" [compact]="true" />
          }
          <span class="action-tag">{{ tag(event) }}</span>
        </div>
        <span class="event-time">{{ formatTime(event.ts) }}</span>
      </div>
    }
  `,
  styles: [`
    /* ─── Design tokens (light/dark aware) ─── */
    :host {
      --ec-bg:       var(--color-neutral-50);
      --ec-border:   var(--color-border);
      --ec-left:      var(--color-neutral-300);
      --ec-text:      var(--color-text);
      --ec-muted:     var(--color-text-muted);
      --ec-tag-bg:    var(--color-neutral-100);
      --ec-tag-text:  var(--color-text-muted);
    }
    :host-context(.dark) {
      --ec-bg:       color-mix(in srgb, var(--color-neutral-800) 65%, transparent);
      --ec-border:   var(--color-neutral-700);
      --ec-left:     var(--color-neutral-600);
      --ec-text:     var(--color-neutral-200);
      --ec-muted:    var(--color-neutral-500);
      --ec-tag-bg:   color-mix(in srgb, var(--color-neutral-700) 70%, transparent);
      --ec-tag-text: var(--color-neutral-400);
    }

    /* ─── Base card ─── */
    .event-card {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 6px var(--space-2);
      border-radius: var(--radius-xl);
      background: var(--ec-bg);
      border: 1px solid var(--ec-border);
      border-left: 3px solid var(--ec-left);
      margin: 3px 0;
    }

    .event-avatar, .avatar-wrap { flex-shrink: 0; }
    .event-body {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      font-size: var(--text-xs);
      min-width: 0;
    }
    .event-nickname {
      font-weight: var(--font-semibold);
      color: var(--ec-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .event-time {
      font-size: var(--text-2xs);
      color: var(--ec-muted);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

    /* ─── Action tag (unified pill style) ─── */
    .action-tag {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 1px 6px;
      border-radius: var(--radius-full);
      background: var(--ec-tag-bg);
      color: var(--ec-tag-text);
      white-space: nowrap;
    }

    /* ─── Follow card ─── */
    .follow { --ec-left: var(--color-primary-400); }
    .follow .event-nickname { color: var(--color-primary-600); }
    :host-context(.dark) .follow { --ec-left: var(--color-primary-600); }
    :host-context(.dark) .follow .event-nickname { color: var(--color-primary-300); }

    .mutual { --ec-left: var(--color-berry-400); }
    .mutual .event-nickname { color: var(--color-berry-600); }
    :host-context(.dark) .mutual { --ec-left: var(--color-berry-600); }
    :host-context(.dark) .mutual .event-nickname { color: var(--color-berry-300); }

    .mutual-tag {
      background: color-mix(in srgb, var(--color-berry-500) 14%, transparent);
      color: var(--color-berry-700);
    }
    :host-context(.dark) .mutual-tag {
      background: color-mix(in srgb, var(--color-berry-500) 26%, transparent);
      color: var(--color-berry-300);
    }

    /* ─── Note cards (join / quit / raise / mod) ─── */
    .note-user_join { --ec-left: var(--color-primary-400); }
    .note-user_join .action-tag {
      background: color-mix(in srgb, var(--color-primary-500) 14%, transparent);
      color: var(--color-primary-700);
    }
    :host-context(.dark) .note-user_join { --ec-left: var(--color-primary-600); }
    :host-context(.dark) .note-user_join .action-tag {
      background: color-mix(in srgb, var(--color-primary-500) 26%, transparent);
      color: var(--color-primary-300);
    }

    .note-user_quit { --ec-left: var(--color-neutral-300); }
    :host-context(.dark) .note-user_quit { --ec-left: var(--color-neutral-600); }

    .note-stage_raisehand { --ec-left: var(--color-accent-400); }
    .note-stage_raisehand .action-tag {
      background: color-mix(in srgb, var(--color-accent-500) 14%, transparent);
      color: var(--color-accent-700);
    }
    :host-context(.dark) .note-stage_raisehand { --ec-left: var(--color-accent-600); }
    :host-context(.dark) .note-stage_raisehand .action-tag {
      background: color-mix(in srgb, var(--color-accent-500) 26%, transparent);
      color: var(--color-accent-300);
    }

    .note-stage_raisehand.raised {
      --ec-left: var(--color-accent-500);
      border-left-width: 4px;
    }

    .note-mod_accepted { --ec-left: var(--color-gold-400); }
    .note-mod_accepted .action-tag {
      background: color-mix(in srgb, var(--color-gold-500) 16%, transparent);
      color: var(--color-gold-700);
    }
    :host-context(.dark) .note-mod_accepted { --ec-left: var(--color-gold-600); }
    :host-context(.dark) .note-mod_accepted .action-tag {
      background: color-mix(in srgb, var(--color-gold-500) 28%, transparent);
      color: var(--color-gold-300);
    }

    .note-mod_removed { --ec-left: var(--color-neutral-300); }
    :host-context(.dark) .note-mod_removed { --ec-left: var(--color-neutral-600); }

    /* ─── Icon badge (small colored circle) ─── */
    .avatar-wrap { position: relative; }
    .icon-badge {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-on-color);
      border: 1.5px solid var(--color-card);
    }
    :host-context(.dark) .icon-badge { border-color: var(--color-neutral-900); }
    .icon-badge-user_join    { background: var(--color-primary-500); }
    .icon-badge-user_quit    { background: var(--color-neutral-400); }
    .icon-badge-stage_raisehand { background: var(--color-accent-500); }
    .icon-badge-mod_accepted  { background: var(--color-gold-500); }
    .icon-badge-mod_removed   { background: var(--color-neutral-400); }
    .icon-badge svg.rotated { transform: rotate(180deg); }

    /* ─── Whiteboard ─── */
    .wb { --ec-left: var(--color-neutral-300); }
    .wb.wb-active { --ec-left: var(--color-warm-400); }
    .wb-icon {
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--color-neutral-500) 12%, transparent);
      color: var(--color-neutral-500);
      transition: background 0.2s, color 0.2s;
    }
    .wb-icon.active {
      background: color-mix(in srgb, var(--color-warm-500) 14%, transparent);
      color: var(--color-warm-600);
    }
    :host-context(.dark) .wb-icon {
      background: color-mix(in srgb, var(--color-neutral-600) 30%, transparent);
      color: var(--color-neutral-400);
    }
    :host-context(.dark) .wb-icon.active {
      background: color-mix(in srgb, var(--color-warm-500) 22%, transparent);
      color: var(--color-warm-300);
    }
    .wb-tag { font-size: 9px; }
    .live-dot {
      position: absolute;
      top: -1px;
      right: -1px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-warm-500);
      border: 1.5px solid var(--color-card);
    }
    :host-context(.dark) .live-dot { border-color: var(--color-neutral-900); }

    /* ─── Kick ─── */
    .kick {
      --ec-left: var(--color-warm-400);
      background: color-mix(in srgb, var(--color-warm-50) 60%, transparent);
      border-color: color-mix(in srgb, var(--color-warm-200) 60%, transparent);
    }
    .kick .event-nickname { color: var(--color-warm-700); }
    .kick-tag {
      background: color-mix(in srgb, var(--color-warm-500) 14%, transparent);
      color: var(--color-warm-700);
    }
    :host-context(.dark) .kick {
      --ec-left: var(--color-warm-600);
      background: color-mix(in srgb, var(--color-warm-900) 30%, transparent);
      border-color: color-mix(in srgb, var(--color-warm-700) 45%, transparent);
    }
    :host-context(.dark) .kick .event-nickname { color: var(--color-warm-300); }
    :host-context(.dark) .kick-tag {
      background: color-mix(in srgb, var(--color-warm-500) 26%, transparent);
      color: var(--color-warm-300);
    }
    .kick-by {
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
      font-style: italic;
    }
    :host-context(.dark) .kick-by { color: var(--color-neutral-500); }

    /* ─── Gift card ─── */
    .gift {
      --ec-left: var(--color-gold-400);
      background: color-mix(in srgb, var(--color-gold-50) 80%, transparent);
      border-color: color-mix(in srgb, var(--color-gold-200) 50%, transparent);
    }
    .gift .event-nickname { color: var(--color-gold-700); font-weight: var(--font-bold); }
    .gift-label {
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 1px 6px;
      border-radius: var(--radius-full);
      background: var(--color-gold-500);
      color: var(--color-on-color);
    }
    :host-context(.dark) .gift {
      background: color-mix(in srgb, var(--color-gold-900) 40%, transparent);
      border-color: color-mix(in srgb, var(--color-gold-600) 50%, transparent);
    }
    :host-context(.dark) .gift .event-nickname { color: var(--color-gold-300); }

    .gift-icon-wrap {
      position: relative;
      flex-shrink: 0;
      width: 30px;
      height: 30px;
    }
    .gift-icon {
      width: 100%;
      height: 100%;
      border-radius: var(--radius-full);
      object-fit: cover;
      box-shadow: 0 0 0 2px var(--color-gold-400);
      background: var(--color-card);
    }
    .gift-icon-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-gold-600);
      background: var(--color-gold-100);
      border-radius: var(--radius-full);
      width: 100%;
      height: 100%;
    }
    :host-context(.dark) .gift-icon-fallback {
      background: color-mix(in srgb, var(--color-gold-700) 35%, transparent);
      color: var(--color-gold-300);
    }
    .combo-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      font-size: 9px;
      font-weight: var(--font-bold);
      color: var(--color-on-color);
      background: var(--color-warm-500);
      padding: 0 4px;
      border-radius: var(--radius-full);
      line-height: 14px;
      box-shadow: 0 0 0 1.5px var(--color-card);
    }
    :host-context(.dark) .combo-badge { box-shadow: 0 0 0 1.5px var(--color-neutral-900); }

    .gift-sender {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .sender-avatar { flex-shrink: 0; }
    .gift-arrow { color: var(--color-gold-400); flex-shrink: 0; }
    :host-context(.dark) .gift-arrow { color: var(--color-gold-600); }
    .gift-receiver-avatar { flex-shrink: 0; opacity: 0.85; }
    .receiver-name {
      color: var(--ec-muted);
      font-weight: var(--font-medium);
    }

    .coin-pill {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 9px;
      font-weight: var(--font-bold);
      font-variant-numeric: tabular-nums;
      color: var(--color-gold-700);
      background: color-mix(in srgb, var(--color-gold-500) 12%, transparent);
      padding: 1px 6px;
      border-radius: var(--radius-full);
      margin-left: 2px;
    }
    :host-context(.dark) .coin-pill {
      color: var(--color-gold-300);
      background: color-mix(in srgb, var(--color-gold-500) 22%, transparent);
    }

    /* ─── Accessibility ─── */
    @media (prefers-reduced-motion: reduce) {
      /* no animations */
    }
  `],
})
export class EventCardComponent {
  readonly card = input.required<EventCard>();

  avatarUrl(card: EventCard): string {
    return 'headUrl' in card ? (card.headUrl ?? '') : '';
  }

  nationality(card: EventCard): string | null {
    return 'nationality' in card ? card.nationality : null;
  }

  giftIconUrl(card: EventCard): string {
    return card.kind === 'gift' ? (card.giftIconUrl ?? '') : '';
  }

  initials(card: EventCard): string {
    const n = this.name(card);
    return n === 'Someone' ? '??' : initialsFrom(n);
  }

  giftReceiverInitials(card: EventCard): string {
    if (card.kind !== 'gift' || !card.receiverNickname) return '??';
    return initialsFrom(card.receiverNickname);
  }

  name(card: EventCard): string {
    return 'nickname' in card && card.nickname ? card.nickname : 'Someone';
  }

  giftLabel(card: EventCard): string {
    return card.kind === 'gift' ? (card.giftName || 'gift') : '';
  }

  tag(card: EventCard): string {
    switch (card.kind) {
      case 'follow': return card.isFollowBack ? 'followed back' : 'followed you';
      case 'user_join': return 'joined';
      case 'user_quit': return 'left';
      case 'stage_raisehand': return card.isRaised ? 'raised hand' : 'lowered hand';
      case 'whiteboard_activated': return 'whiteboard on';
      case 'whiteboard_deactivated': return 'whiteboard off';
      case 'mod_accepted': return 'now moderating';
      case 'mod_removed': return 'mod removed';
      case 'stage_kick': return 'stage kick';
      case 'room_kick': return 'room kick';
      default: return '';
    }
  }

  formatTime = formatClockTime;
}
