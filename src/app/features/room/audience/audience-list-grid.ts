import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { AudienceUserComponent } from '../ui/audience-user';
import { AudienceUser } from '../models/room-model';
import { LucideUsers } from '@lucide/angular';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';
import { ViewMode, LanguageGroup } from './audience-list-shared';

/**
 * Pure presentational rendering of the audience roster — grid view, per-language
 * list view, and the empty state. No state of its own; everything the two view
 * modes need is already computed by the parent AudienceListComponent.
 */
@Component({
  selector: 'app-audience-list-grid',
  imports: [AudienceUserComponent, LucideUsers, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="audience-scroll">
      @if (viewMode() === 'grid') {
        <div class="audience-grid" role="list">
          @for (user of displayUsers(); track user.userId) {
            <app-audience-user
              [user]="user"
              display="grid"
              [speaking]="speakingUids().includes(user.userId)"
              [canInvite]="canInviteToStage()"
              [inviteBusy]="inviteBusy() === user.userId"
              [currentUserId]="currentUserId()"
              [isMicOn]="selfIsPublishing() && user.userId === currentUserId()"
              [speakBusy]="selfSpeakBusy()"
              (userClick)="userClick.emit($event)"
              (invite)="inviteToStage.emit($event)"
              (speak)="speakToggle.emit()"
            />
          }
        </div>
      } @else {
        @for (group of languageGroups(); track group.language) {
          <div class="lang-group">
            <div class="lang-header">
              <span class="lang-flag">{{ group.flag }}</span>
              <span class="lang-name">{{ group.language }}</span>
              <span class="lang-count">{{ group.users.length }}</span>
            </div>
            <div class="lang-users">
              @for (user of group.users; track user.userId) {
                <app-audience-user
                  [user]="user"
                  display="list"
                  [speaking]="speakingUids().includes(user.userId)"
                  [canInvite]="canInviteToStage()"
                  [inviteBusy]="inviteBusy() === user.userId"
                  [currentUserId]="currentUserId()"
                  [isMicOn]="selfIsPublishing() && user.userId === currentUserId()"
                  [speakBusy]="selfSpeakBusy()"
                  (invite)="inviteToStage.emit($event)"
                  (speak)="speakToggle.emit()"
                />
              }
            </div>
          </div>
        }
      }

      @if (displayUsers().length === 0) {
        @if (searchQuery(); as query) {
          <app-empty-state [compact]="true" [title]="'No matches for “' + query + '”'" body="Try a different name or language">
            <svg empty-state-icon aria-hidden="true" lucideUsers [size]="20"></svg>
            <button empty-state-actions class="clear-search-btn" type="button" (click)="clearSearch.emit()">Clear search</button>
          </app-empty-state>
        } @else {
          <app-empty-state [compact]="true" title="No listeners yet" body="Share this room to invite people to join the conversation">
            <svg empty-state-icon aria-hidden="true" lucideUsers [size]="20"></svg>
          </app-empty-state>
        }
      }
    </div>
  `,
  styles: [`
    .audience-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      /* Stop iOS rubber-band from chaining past the scroll container. */
      overscroll-behavior: contain;
    }

    .audience-grid {
      display: flex;
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
    }

    .audience-grid::-webkit-scrollbar {
      height: 4px;
    }

    .audience-grid::-webkit-scrollbar-track {
      background: transparent;
    }

    .audience-grid::-webkit-scrollbar-thumb {
      background: var(--color-neutral-300);
      border-radius: 2px;
    }

    .audience-grid::-webkit-scrollbar-thumb:hover {
      background: var(--color-neutral-400);
    }

    .lang-group {
      padding: var(--space-2) var(--space-3);
      border-bottom: 1px solid var(--color-border);
    }

    .lang-header {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin-bottom: var(--space-2);
    }

    .lang-flag {
      font-size: var(--text-sm);
    }

    .lang-name {
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--color-text-secondary);
    }

    .lang-count {
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
      padding: 1px 6px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-100);
    }

    .lang-users {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .clear-search-btn {
      margin-top: var(--space-2);
      min-height: 36px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: var(--color-card);
      color: var(--color-text);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s;
    }

    .clear-search-btn:hover {
      background: var(--color-neutral-50);
    }
    .clear-search-btn:focus-visible {
      outline: var(--focus-ring); outline-offset: 2px;
    }

    .clear-search-btn:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    /* Dark mode */
    :host-context(.dark) {
      .lang-count {
        background: var(--color-neutral-700);
        color: var(--color-neutral-400);
      }

      .empty-icon {
        background: var(--color-neutral-800);
        color: var(--color-neutral-400);
      }

      .empty-text {
        color: var(--color-neutral-200);
      }

      .empty-sub {
        color: var(--color-neutral-400);
      }

      .clear-search-btn {
        background: var(--color-neutral-800);
        border-color: var(--color-neutral-700);
        color: var(--color-neutral-100);
      }

      .clear-search-btn:hover {
        background: var(--color-neutral-700);
      }

      .audience-grid::-webkit-scrollbar-thumb {
        background: var(--color-neutral-600);
      }

      .audience-grid::-webkit-scrollbar-thumb:hover {
        background: var(--color-neutral-500);
      }
    }
  `],
})
export class AudienceListGridComponent {
  readonly viewMode = input.required<ViewMode>();
  readonly displayUsers = input.required<readonly AudienceUser[]>();
  readonly languageGroups = input.required<readonly LanguageGroup[]>();
  readonly speakingUids = input.required<readonly number[]>();
  readonly canInviteToStage = input.required<boolean>();
  readonly inviteBusy = input.required<number | null>();
  readonly currentUserId = input.required<number>();
  readonly searchQuery = input.required<string>();
  readonly selfIsPublishing = input<boolean>(false);
  readonly selfSpeakBusy = input<boolean>(false);

  readonly userClick = output<AudienceUser>();
  readonly inviteToStage = output<AudienceUser>();
  readonly clearSearch = output<void>();
  readonly speakToggle = output<void>();
}
