import { Component, ChangeDetectionStrategy, input, output, computed, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LucideUsers, LucideCrown, LucideEye, LucideEyeOff } from '@lucide/angular';
import { ChannelListItem } from '../../data/rooms-model';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { TooltipDirective } from '@shared/directives/tooltip.directive';

@Component({
  selector: 'app-room-card',

  imports: [AvatarComponent, ButtonComponent, CountryFlagComponent, LanguageTagComponent, TooltipDirective, LucideUsers, LucideCrown, LucideEye, LucideEyeOff],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="room-card"
      tabindex="0"
      [attr.aria-label]="'Join room ' + room().channel.name + ' hosted by ' + room().hostUser.nickname"
      (click)="handleJoin()"
      (keydown.enter)="handleJoin()"
      (keydown.space)="handleJoin()"
    >
            <div class="card-header">
        <h3 class="card-title">{{ room().channel.name }}</h3>
        @if (room().categoryTopicTag?.topicName) {
          <p class="card-topic">{{ room().categoryTopicTag?.topicName }}</p>
        }
      </div>

            <div class="card-host">
        <app-avatar
          [src]="room().hostUser.headUrl || ''"
          size="md"
          [alt]="room().hostUser.nickname"
          [appTooltip]="room().hostUser.nickname"
          tooltipPosition="top"
        />
        <div class="host-info">
          <div class="host-name-row">
            <span class="host-name">{{ room().hostUser.nickname }}</span>
            <svg aria-hidden="true" lucideCrown [size]="10" class="crown-icon">
              <title>Host</title>
            </svg>
          </div>
          @if (room().hostUser.nationality) {
            <app-country-flag [code]="room().hostUser.nationality" />
          }
        </div>
      </div>

            @if (room().channel.langId) {
        <div class="tags-row">
          <span class="tag">
            <app-language-tag [langId]="room().channel.langId" />
          </span>
        </div>
      }

            @if (visibleMembers().length > 0) {
        <div class="card-members">
          <div class="member-avatars">
            @for (user of visibleMembers(); track user.userId; let i = $index) {
              <app-avatar
                [src]="user.headUrl || ''"
                size="sm"
                class="member-avatar"
                [style.z-index]="10 - i"
                [alt]="user.nickname"
                [appTooltip]="user.nickname"
                tooltipPosition="top"
              />
            }
          </div>
          <span class="members-count">
            <svg aria-hidden="true" lucideUsers [size]="10"></svg>
            {{ room().channel.totalUserCount }}
          </span>
        </div>
      }

            <div class="card-actions">
        <app-button
          variant="primary"
          [size]="buttonSize()"
          (click)="handleJoinVisible($event)"
          [attr.aria-label]="'Join ' + room().channel.name + ' as visible'"
        >
          <svg aria-hidden="true" lucideEye [size]="11"></svg>
          Visible
        </app-button>
        <app-button
          variant="soft-warm"
          [size]="buttonSize()"
          (click)="handleJoinInvisible($event)"
          [attr.aria-label]="'Join ' + room().channel.name + ' as invisible'"
        >
          <svg aria-hidden="true" lucideEyeOff [size]="11"></svg>
          Invisible
        </app-button>
      </div>
    </article>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-width: 180px;
    }

    .room-card {
      background-color: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--space-4);
      cursor: pointer;
      transition:
        transform 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      height: 100%;
      box-sizing: border-box;
    }

    .room-card:hover {
      transform: translateY(-2px);
      border-color: var(--color-primary-300);
      box-shadow: var(--shadow-sm);
    }

    .room-card:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

        .card-header {
      display: flex;
      flex-direction: column;
      gap: 2px;
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

    .card-topic {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: 0;
      line-height: 1.4;
    }

        .card-host {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .host-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .host-name-row {
      display: flex;
      align-items: center;
      gap: 4px;
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

        .tags-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px var(--space-2);
      border-radius: var(--radius-full);
      font-size: 10px;
      font-weight: var(--font-medium);
      white-space: nowrap;
      background-color: var(--color-neutral-100);
      color: var(--color-text-secondary);
    }

        .card-members {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .member-avatars {
      display: flex;
    }

    .member-avatar {
      margin-left: calc(-1 * var(--space-2));
      border: 2px solid var(--color-card);
      border-radius: var(--radius-full);

      &:first-child {
        margin-left: 0;
      }

      :host-context(.dark) & {
        border-color: var(--color-neutral-800);
      }
    }

    .members-count {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-weight: var(--font-medium);
      white-space: nowrap;
    }

        .card-actions {
      display: flex;
      justify-content: space-between;
      margin-top: auto;
    }

        :host-context(.dark) {
      .room-card {
        background-color: var(--color-neutral-800);
        border-color: var(--color-neutral-700);
      }

      .room-card:hover {
        border-color: var(--color-primary-700);
        box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
      }

      .host-name {
        color: var(--color-neutral-200);
      }

      .card-topic {
        color: var(--color-neutral-400);
      }

      .members-count {
        color: var(--color-neutral-400);
      }

      .tag {
        background-color: var(--color-neutral-700);
        color: var(--color-neutral-300);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .room-card:hover {
        transform: none;
      }
    }
  `]
})
export class RoomCardComponent {
  readonly room = input.required<ChannelListItem>();
  readonly joinRoom = output<{ room: ChannelListItem; visible: boolean }>();

  readonly visibleMembers = computed(() => this.room().users?.slice(0, 4) ?? []);

  /** 'sm' (32px) is a fine touch target on desktop pointer input, but under
   *  the ~44px Apple HIG/Material minimum on a touch screen — these two
   *  buttons are the card's entire purpose, so bump to 'lg' (40px) on mobile. */
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isMobile = signal(false);
  readonly buttonSize = computed<'sm' | 'lg'>(() => (this.isMobile() ? 'lg' : 'sm'));

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const mql = window.matchMedia('(max-width: 1023.98px)');
      const apply = () => this.isMobile.set(mql.matches);
      apply();
      if ('addEventListener' in mql) {
        mql.addEventListener('change', apply);
      } else if ('addListener' in mql) {
        (mql as unknown as { addListener: (cb: () => void) => void }).addListener(apply);
      }
    }
  }

  handleJoin(): void {
    this.joinRoom.emit({ room: this.room(), visible: true });
  }

  handleJoinVisible(event: Event): void {
    event.stopPropagation();
    this.joinRoom.emit({ room: this.room(), visible: true });
  }

  handleJoinInvisible(event: Event): void {
    event.stopPropagation();
    this.joinRoom.emit({ room: this.room(), visible: false });
  }
}
