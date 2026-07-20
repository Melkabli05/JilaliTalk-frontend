import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { LucideFlame, LucideUsers, LucideCrown, LucideEyeOff, LucideShare2 } from '@lucide/angular';
import { ChannelListItem } from '../../data/rooms-model';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';

@Component({
  selector: 'app-live-room-card',
  host: {
    '[class.recommended]': 'recommended()',
  },
  imports: [NgOptimizedImage, AvatarComponent, ButtonComponent, CountryFlagComponent, LanguageTagComponent, LucideFlame, LucideUsers, LucideCrown, LucideEyeOff, LucideShare2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="live-card"
      tabindex="0"
      [attr.aria-label]="'Join live room ' + room().channel.name + ' hosted by ' + room().hostUser.nickname"
      (keydown.enter)="handleJoin()"
      (keydown.space)="handleJoin()"
    >
      <button
        type="button"
        class="share-btn"
        [attr.aria-label]="'Share ' + room().channel.name"
        (click)="handleShare($event)"
      >
        <svg aria-hidden="true" lucideShare2 [size]="14"></svg>
      </button>

            <div class="card-thumbnail">
        @if (room().hostUser.headUrl; as headUrl) {
          <img
            class="thumbnail-img"
            [ngSrc]="headUrl"
            fill
            [alt]="room().channel.name"
          />
        } @else {
          <div class="thumbnail-placeholder">
            <img
              class="placeholder-flag"
              [src]="flagUrl()"
              [alt]="room().channel.name"
              (error)="flagError.set(true)"
            />
          </div>
        }

                <div class="thumbnail-gradient"></div>

                <div class="thumbnail-top">
          @if (room().channel.totalUserCount > 0) {
            <div class="live-badge">
              <span class="live-dot"></span>
              LIVE
            </div>
          } @else {
            <div class="live-badge ended">ENDED</div>
          }

          <div class="viewer-badge">
            <svg aria-hidden="true" lucideUsers [size]="10"></svg>
            {{ viewerCount() }}
          </div>
        </div>

                @if (heat() > 30) {
          <div class="heat-badge">
            <svg aria-hidden="true" lucideFlame [size]="10"></svg>
            {{ heat() }}
          </div>
        }
      </div>

            <div class="card-body">
        <div class="host-row">
          <app-avatar
            [src]="room().hostUser.headUrl || ''"
            size="sm"
            [alt]="room().hostUser.nickname"
            class="host-avatar"
          />
          <div class="host-text">
            <span class="host-name">{{ room().hostUser.nickname }}</span>
            <svg aria-hidden="true" lucideCrown [size]="10" class="crown-icon">
              <title>Host</title>
            </svg>
            @if (room().hostUser.nationality) {
              <app-country-flag [code]="room().hostUser.nationality" />
            }
          </div>
        </div>

        <h3 class="card-title">{{ room().channel.name }}</h3>

        <div class="tags-row">
          @if (room().categoryTopicTag?.categoryName) {
            <span class="tag category-tag">{{ room().categoryTopicTag?.categoryName }}</span>
          }
          @if (room().hostUser.nationality) {
            <span class="tag lang-tag">
              <app-country-flag [code]="room().hostUser.nationality" />
            </span>
          }
          @if (room().channel.langId) {
            <span class="tag lang-tag">
              <app-language-tag [langId]="room().channel.langId" />
            </span>
          }
        </div>

        <div class="card-actions">
          <app-button
            variant="primary"
            size="sm"
            class="join-visible-btn"
            (click)="handleJoin($event)"
            [disabled]="room().channel.totalUserCount === 0"
          >
            Join
          </app-button>
          <button
            type="button"
            class="invisible-btn"
            aria-label="Join invisible"
            [disabled]="room().channel.totalUserCount === 0"
            (click)="handleInvisibleJoin($event)"
          >
            <svg aria-hidden="true" lucideEyeOff [size]="13"></svg>
          </button>
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; height: 100%; flex: 1; min-width: 180px; }

    .live-card {
      position: relative;
      background-color: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      overflow: hidden;
      cursor: pointer;
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease,
        border-color 0.15s ease;
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
    }

    .share-btn {
      position: absolute; top: var(--space-2); right: var(--space-2); z-index: 3;
      width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
      border: 0; border-radius: var(--radius-full);
      background: rgb(0 0 0 / 55%); backdrop-filter: blur(4px);
      color: white; cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background-color 0.15s ease;
    }
    .share-btn:hover { background: rgb(0 0 0 / 75%); }
    .share-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    @media (max-width: 767.98px) {
      .share-btn { width: 40px; height: 40px; }
    }

    .live-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-card-hover);
      border-color: var(--color-primary-300);
    }

    .live-card:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    .card-thumbnail {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background-color: var(--color-neutral-800);
      overflow: hidden;
      flex-shrink: 0;
    }

    .thumbnail-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .thumbnail-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--color-neutral-800);
    }

    .placeholder-flag {
      width: 64px;
      height: 48px;
      object-fit: cover;
      border-radius: var(--radius-md);
      opacity: 0.6;
    }

    .thumbnail-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(0, 0, 0, 0.75) 0%,
        rgba(0, 0, 0, 0.3) 40%,
        transparent 70%
      );
      pointer-events: none;
    }

    .thumbnail-top {
      position: absolute;
      top: var(--space-2);
      left: var(--space-2);
      right: var(--space-2);
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 2;
    }

    .live-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px var(--space-2);
      background-color: var(--color-live-bg);
      color: white;
      border-radius: var(--radius-sm);
      font-size: 10px;
      font-weight: var(--font-bold);
      letter-spacing: 0.5px;
    }

    .live-badge.ended,
    .live-badge.idle {
      background-color: var(--color-ended-bg);
    }

    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: white;
      animation: var(--animate-pulse-live);
    }

    .viewer-badge {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 2px var(--space-2);
      background-color: rgb(0 0 0 / 60%);
      backdrop-filter: blur(4px);
      color: white;
      border-radius: var(--radius-sm);
      font-size: 10px;
      font-weight: var(--font-semibold);
    }

    .heat-badge {
      position: absolute;
      top: calc(var(--space-2) + 24px);
      right: var(--space-2);
      z-index: 3;
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 2px var(--space-2);
      background-color: var(--color-live-bg);
      color: white;
      border-radius: var(--radius-sm);
      font-size: 10px;
      font-weight: var(--font-bold);
    }

    .card-body {
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      flex: 1;
      min-width: 0;
    }

    @media (width <= 640px) {
      .card-thumbnail {
        aspect-ratio: 16 / 9;
        max-height: 120px;
      }
      .card-body {
        padding: var(--space-2);
        gap: var(--space-1);
      }
      .card-title {
        -webkit-line-clamp: 1;
        font-size: var(--text-xs);
      }
      .card-actions {
        gap: var(--space-1);
      }
    }

    .host-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .host-avatar {
      border: 2px solid var(--color-primary-100);
      flex-shrink: 0;

      :host-context(.dark) & {
        border-color: var(--color-neutral-700);
      }
    }

    .host-text {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .host-name {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }

    .crown-icon {
      color: var(--color-gold-400);
      flex-shrink: 0;
    }

    .card-title {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: 0;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    :host.recommended .card-title {
      -webkit-line-clamp: 1;
    }

    .tags-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: auto;
    }

    .invisible-btn {
      display: flex; align-items: center; justify-content: center;
      width: 44px; height: 44px;
      border: 1.5px solid var(--color-border); border-radius: var(--radius-lg);
      background: transparent; color: var(--color-text-muted); cursor: pointer; flex-shrink: 0;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: border-color 0.15s, color 0.15s, background-color 0.15s;
      &:hover { border-color: var(--color-primary-200); color: var(--color-primary-text); background-color: var(--color-primary-50); }
      &:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
      :host-context(.dark) & { border-color: var(--color-neutral-600); color: var(--color-neutral-400); background: transparent;
        &:hover { border-color: var(--color-primary-700); color: var(--color-primary-300); background-color: var(--color-primary-900); } }
    }

    .join-visible-btn { flex: 1; }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px var(--space-2);
      border-radius: var(--radius-full);
      font-size: 10px;
      font-weight: var(--font-medium);
      white-space: nowrap;
    }

    .category-tag {
      background-color: var(--color-primary-50);
      color: var(--color-primary-text);

      :host-context(.dark) & {
        background-color: var(--color-primary-900);
        color: var(--color-primary-300);
      }
    }

    .lang-tag {
      background-color: var(--color-neutral-100);
      color: var(--color-text-secondary);

      :host-context(.dark) & {
        background-color: var(--color-neutral-700);
        color: var(--color-neutral-300);
      }
    }

    :host-context(.dark) {
      .live-card {
        background-color: var(--color-neutral-800);
        border-color: var(--color-neutral-700);
      }

      .live-card:hover {
        border-color: var(--color-primary-700);
        box-shadow: 0 12px 32px rgb(0 0 0 / 40%);
      }

      .thumbnail-placeholder {
        background-color: var(--color-neutral-900);
      }

      .live-badge.ended,
      .live-badge.idle {
        background-color: var(--color-neutral-600);
      }

      .viewer-badge {
        background-color: rgb(0 0 0 / 70%);
      }

      .heat-badge {
        background-color: var(--color-live-bg);
      }

      .host-name {
        color: var(--color-neutral-200);
      }

      .card-title {
        color: var(--color-neutral-200);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .live-dot { animation: none; }
      .live-card:hover { transform: none; }
    }
  `]
})
export class LiveRoomCardComponent {
  readonly room = input.required<ChannelListItem>();
  readonly recommended = input(false);
  readonly joinRoom = output<{ room: ChannelListItem; visible: boolean }>();
  readonly share = output<ChannelListItem>();

  protected readonly flagError = signal(false);
  protected readonly flagUrl = computed(() => {
    if (this.flagError()) return '';
    const n = this.room().hostUser.nationality?.toLowerCase();
    return n ? `https://flagcdn.com/w80/${n}.png` : '';
  });

  heat = computed(() => this.room().channel.heatValue ?? 0);

  readonly viewerCount = computed(() => {
    const count = this.room().channel.totalUserCount;
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  });

  handleJoin(event?: Event): void {
    event?.stopPropagation();
    if (this.room().channel.totalUserCount > 0) {
      this.joinRoom.emit({ room: this.room(), visible: true });
    }
  }

  handleInvisibleJoin(event: Event): void {
    event?.stopPropagation();
    if (this.room().channel.totalUserCount > 0) {
      this.joinRoom.emit({ room: this.room(), visible: false });
    }
  }

  handleShare(event: Event): void {
    event.stopPropagation();
    this.share.emit(this.room());
  }
}
