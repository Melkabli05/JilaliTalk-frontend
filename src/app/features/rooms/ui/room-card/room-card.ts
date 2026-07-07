import { Component, ChangeDetectionStrategy, input, output, computed, inject } from '@angular/core';
import { LucideUsers, LucideCrown, LucideEye, LucideEyeOff } from '@lucide/angular';
import { ChannelListItem } from '../../data/rooms-model';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { RoomsPreferencesStore } from '@store/rooms-preferences.store';

@Component({
  selector: 'app-room-card',

  imports: [AvatarComponent, ButtonComponent, CountryFlagComponent, LanguageTagComponent, TooltipDirective, LucideUsers, LucideCrown, LucideEye, LucideEyeOff],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="room-card"
      tabindex="0"
      [attr.aria-label]="'Join room ' + room().channel.name + ' hosted by ' + room().hostUser.nickname"
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
          @if (isActive()) {
            <span class="live-dot" aria-label="Live now"></span>
          }
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
        <!-- Primary: visible join (most common case) -->
        <app-button
          variant="primary"
          size="sm"
          class="join-visible-btn"
          (click)="handleJoinVisible($event)"
          [attr.aria-label]="'Join ' + room().channel.name"
        >
          <svg aria-hidden="true" lucideEye [size]="11"></svg>
          Join
        </app-button>

        <!-- Secondary: invisible join — small icon button -->
        <div class="invisible-btn-wrap">
          <button
            type="button"
            class="invisible-btn"
            aria-label="Join invisible"
            (click)="handleJoinInvisible($event)"
          >
            <svg aria-hidden="true" lucideEyeOff [size]="13"></svg>
          </button>
          @if (showInvisibleTooltip()) {
            <span class="invisible-hint">Hidden listen</span>
          }
        </div>
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
      gap: var(--space-2);
    }

    .live-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background-color: #22c55e; flex-shrink: 0;
      animation: pulse-dot 2s ease-in-out infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(0.85); }
    }
    :host-context(.dark) .live-dot { background-color: #16a34a; }

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
      align-items: center;
      gap: var(--space-2);
      margin-top: auto;
    }

        .invisible-btn {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px;
      border: 1.5px solid var(--color-border); border-radius: var(--radius-lg);
      background: transparent; color: var(--color-text-muted); cursor: pointer; flex-shrink: 0;
      transition: border-color 0.15s, color 0.15s, background-color 0.15s;
      &:hover { border-color: var(--color-primary-200); color: var(--color-primary-600); background-color: var(--color-primary-50); }
      &:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
      :host-context(.dark) & { border-color: var(--color-neutral-600); color: var(--color-neutral-400); background: transparent;
        &:hover { border-color: var(--color-primary-700); color: var(--color-primary-300); background-color: var(--color-primary-900); } }
    }

    .join-visible-btn { flex: 1; }

    .invisible-btn-wrap {
      position: relative; display: flex; align-items: center;
    }
    .invisible-hint {
      position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%);
      white-space: nowrap; background: var(--color-neutral-800); color: var(--color-neutral-100);
      font-size: 10px; padding: 2px 6px; border-radius: var(--radius-sm);
      pointer-events: none; z-index: 10;
      :host-context(.dark) & { background: var(--color-neutral-700); color: var(--color-neutral-100); }
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

  readonly prefs = inject(RoomsPreferencesStore);

  readonly visibleMembers = computed(() => this.room().users?.slice(0, 4) ?? []);

  readonly showInvisibleTooltip = computed(() =>
    !this.prefs.seenInvisibleTooltip(),
  );

  readonly isActive = computed(() => (this.room().channel.totalUserCount ?? 0) > 5);

  handleJoin(): void {
    this.joinRoom.emit({ room: this.room(), visible: true });
  }

  handleJoinVisible(event: Event): void {
    event.stopPropagation();
    this.joinRoom.emit({ room: this.room(), visible: true });
  }

  handleJoinInvisible(event: Event): void {
    event.stopPropagation();
    this.prefs.markInvisibleTooltipSeen();
    this.joinRoom.emit({ room: this.room(), visible: false });
  }
}
