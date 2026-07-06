import { Component, ChangeDetectionStrategy, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { UserInfoService, type UserInfo } from '@core/services/user-info.service';
import { FollowService } from '@core/services/follow.service';
import { ToastService } from '@core/services/toast.service';
import { AuthStore } from '@core/auth/auth.store';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { UserIdentityCardComponent } from '@shared/ui/user-identity-card/user-identity-card.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { RoomPresenceBannerComponent } from '@shared/ui/room-presence-banner';
import { cnameToBusiType } from '@shared/utils';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';
import { LucideX, LucideCrown, LucideUserPlus, LucideUserCheck, LucideLoader } from '@lucide/angular';

export interface UserInfoModalData {
  readonly userId: number;
  readonly nickname?: string | null;
  readonly headUrl?: string | null;
  readonly nationality?: string | null;
}

/**
 * Read-only profile viewer: identity card, stats, and a detail list.
 * Opens via CDK Dialog from anywhere in the app. Fetches enriched profile
 * from UserInfoService. For moderation actions, see the room feature's
 * UserActionModalComponent.
 */
@Component({
  selector: 'app-user-info-modal',
  imports: [
    ModalComponent,
    CountryFlagComponent,
    LanguageTagComponent,
    UserIdentityCardComponent,
    RoomPresenceBannerComponent,
    LucideX,
    LucideCrown,
    LucideUserPlus,
    LucideUserCheck,
    LucideLoader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [noPadding]="true">
      <button type="button" class="close-btn" (click)="ref.close()" aria-label="Close">
        <svg aria-hidden="true" lucideX [size]="14"></svg>
      </button>

      <div class="identity-wrapper">
        <app-user-identity-card
          [avatarUrl]="avatarUrl()"
          [initials]="initials()"
          [displayName]="displayName()"
          [username]="username()"
          [signature]="signature()"
          [ringColor]="vipType() === 100 ? 'var(--color-gold-300)' : 'var(--color-primary-300)'"
          [vip]="vipType() === 100"
        >
          @if (sex() === 'male') {
            <span nameBadge class="sex-badge sex-male">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="14.5" r="5.5"/><path d="M19.5 8 12 15.5M19.5 8l-5.5 0"/></svg>
            </span>
          } @else if (sex() === 'female') {
            <span nameBadge class="sex-badge sex-female">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="14.5" cy="8" r="5.5"/><path d="M14.5 8 12 5.5M14.5 8h-5M12 5.5v8"/></svg>
            </span>
          }
          <ng-container metaChips>
            @if (vipType() === 100) {
              <span class="chip chip-gold"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
            } @else if (vipType() > 0 && vipType() < 100) {
              <span class="chip chip-primary"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
            }
            @if (onlineStatus(); as status) {
              <span class="chip" [class]="onlineChipClass()">{{ status }}</span>
            }
            @if (liveStatus()) {
              <span class="chip chip-live">LIVE</span>
            }
            @if (presenceLabel(); as label) {
              <span class="chip chip-presence">{{ label }}</span>
            }
            @if (streakDays(); as streak) {
              <span class="chip chip-streak">{{ streak }}-day streak</span>
            }
          </ng-container>
        </app-user-identity-card>
      </div>

      <app-room-presence-banner
        [presence]="presence()"
        [hostInfo]="hostInfo()"
        [viewerCname]="viewerCname()"
        (join)="joinRoom($event.visible)"
      />

      @if (canFollow()) {
        <div class="follow-action-row">
          <button
            type="button"
            class="follow-btn"
            [class.follow-btn--following]="isFollowing()"
            [disabled]="isTogglingFollow()"
            (click)="toggleFollow()"
            [attr.aria-label]="followBtnLabel()"
          >
            @if (isTogglingFollow()) {
              <svg aria-hidden="true" lucideLoader [size]="13" class="spin"></svg>
            } @else if (isFollowing()) {
              <svg aria-hidden="true" lucideUserCheck [size]="13"></svg>
            } @else {
              <svg aria-hidden="true" lucideUserPlus [size]="13"></svg>
            }
            {{ followBtnLabel() }}
          </button>
        </div>
      }

      @if (relationStats(); as stats) {
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-val">{{ stats.followers }}</span>
            <span class="stat-lbl">Followers</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ stats.following }}</span>
            <span class="stat-lbl">Following</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ stats.moments }}</span>
            <span class="stat-lbl">Moments</span>
          </div>
          <div class="stat-item">
            <span class="stat-val">{{ stats.likes }}</span>
            <span class="stat-lbl">Likes</span>
          </div>
        </div>
      }

      <div class="modal-body">
        @if (isLoading()) {
          <div class="loading-state">
            <div class="skeleton-row">
              <div class="skeleton-chip"></div>
              <div class="skeleton-chip skeleton-chip--lg"></div>
            </div>
            <div class="skeleton-row">
              <div class="skeleton-chip"></div>
              <div class="skeleton-chip"></div>
            </div>
          </div>
        } @else {
          @if (hasLocationMeta() || nativeLang() || learnLangs().length) {
            <div class="detail-group">
              @if (hasLocationMeta()) {
                <div class="detail-row">
                  <div class="detail-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div class="detail-content">
                    @if (nationality()) {
                      <app-country-flag [code]="nationality()" />
                    }
                    @if (location(); as loc) {
                      <span class="detail-text">{{ loc }}</span>
                    }
                    @if (age(); as a) {
                      <span class="detail-text muted">{{ a }} yrs old</span>
                    }
                    @if (regDays() != null) {
                      <span class="detail-text muted">Member for {{ regDays() }}d</span>
                    }
                  </div>
                </div>
              }

              @if (nativeLang() || learnLangs().length) {
                <div class="detail-row">
                  <div class="detail-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </div>
                  <div class="detail-content">
                    @if (nativeLang(); as lang) {
                      <app-language-tag [langId]="lang" />
                    }
                    @if (learnLangs().length) {
                      <span class="detail-text muted">also learning</span>
                      @for (lang of learnLangs(); track lang.langId) {
                        <app-language-tag [langId]="lang.langId" />
                      }
                    }
                  </div>
                </div>
              }
            </div>
          }

          @if (tagChips().length) {
            <div class="tags-row">
              @for (chip of tagChips(); track $index) {
                <span class="tag">{{ chip }}</span>
              }
            </div>
          }

          @if (giftLevel() || pointsSummary()) {
            <div class="detail-row">
              <div class="detail-icon gold-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div class="detail-content">
                @if (giftLevel(); as level) {
                  <span class="chip chip-gold">Gift {{ level }}</span>
                }
                @if (pointsSummary(); as pts) {
                  <span class="detail-text muted">{{ pts }} points</span>
                }
              </div>
            </div>
          }

          @if (remarkName() || profileUrl()) {
            <div class="links-row">
              @if (remarkName(); as remark) {
                <span class="remark-chip">&#64;{{ remark }}</span>
              }
              @if (profileUrl(); as url) {
                <a class="profile-link" [href]="url" target="_blank" rel="noopener">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  View profile
                </a>
              }
            </div>
          }

          @if (
            !hasLocationMeta() &&
            !nativeLang() &&
            !learnLangs().length &&
            !tagChips().length &&
            !giftLevel() &&
            !pointsSummary() &&
            !remarkName() &&
            !profileUrl()
          ) {
            <div class="empty-state">
              <p class="empty-text">No details yet</p>
            </div>
          }
        }
      </div>
    </app-modal>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        width: 340px;
        max-width: calc(100vw - var(--space-8));
        /* Cap the modal so a long bio + many tags can't push it off-screen. */
        max-height: 85dvh;
        --_modal-radius: var(--radius-xl);
        box-shadow: var(--shadow-modal);
        animation: slideUp 0.2s ease-out;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        :host { animation: none; }
      }

      .identity-wrapper {
        padding-top: calc(26px + var(--space-3));
        background: var(--color-card);
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        animation: itemIn 0.25s ease-out backwards;
      }
      :host-context(.dark) .identity-wrapper {
        background: var(--color-neutral-800);
      }

      .close-btn {
        position: absolute;
        top: var(--space-3);
        right: var(--space-3);
        width: 26px;
        height: 26px;
        border-radius: var(--radius-full);
        border: none;
        background: var(--color-neutral-100);
        color: var(--color-text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, transform 0.15s;
        z-index: 1;
      }
      .close-btn:hover {
        background: var(--color-neutral-200);
        color: var(--color-text);
        transform: rotate(90deg);
      }
      .close-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: 2px;
      }
      :host-context(.dark) .close-btn {
        background: var(--color-neutral-700);
        color: var(--color-neutral-300);
      }
      :host-context(.dark) .close-btn:hover {
        background: var(--color-neutral-600);
        color: var(--color-neutral-100);
      }

      .sex-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: var(--radius-full);
        flex-shrink: 0;
      }
      .sex-male {
        background: hsl(230deg 28% 90%);
        color: hsl(230deg 28% 45%);
      }
      .sex-female {
        background: hsl(10deg 32% 90%);
        color: hsl(10deg 32% 45%);
      }
      :host-context(.dark) .sex-male {
        background: hsl(230deg 20% 25%);
        color: hsl(230deg 20% 60%);
      }
      :host-context(.dark) .sex-female {
        background: hsl(10deg 20% 25%);
        color: hsl(10deg 20% 60%);
      }

      .stats-row {
        display: flex;
        align-items: center;
        margin: var(--space-3) var(--space-4) 0;
        padding-bottom: var(--space-2);
        border-bottom: 1px solid var(--color-border);
      }
      :host-context(.dark) .stats-row {
        border-bottom-color: var(--color-neutral-700);
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        gap: 1px;
      }

      .stat-val {
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        color: var(--color-text);
      }
      :host-context(.dark) .stat-val { color: var(--color-neutral-100); }

      .stat-lbl {
        font-size: 10px;
        color: var(--color-text-muted);
      }
      :host-context(.dark) .stat-lbl { color: var(--color-neutral-400); }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: var(--text-2xs);
        font-weight: var(--font-semibold);
        padding: 2px 6px;
        border-radius: var(--radius-full);
        white-space: nowrap;
      }
      .chip-neutral {
        background: var(--color-neutral-100);
        color: var(--color-text-secondary);
      }
      .chip-primary {
        background: var(--color-primary-50);
        color: var(--color-primary-600);
      }
      .chip-gold {
        background: var(--color-gold-50);
        color: var(--color-gold-600);
      }
      .chip-online {
        background: var(--color-accent-50);
        color: var(--color-accent-600);
      }
      .chip-offline {
        background: var(--color-neutral-100);
        color: var(--color-text-muted);
      }
      .chip-live {
        background: var(--color-error-50);
        color: var(--color-error-600);
      }
      .chip-presence {
        background: var(--color-accent-50);
        color: var(--color-accent-700);
      }
      .chip-streak {
        background: var(--color-gold-50);
        color: var(--color-gold-600);
      }
      :host-context(.dark) .chip-offline {
        background: var(--color-neutral-700);
        color: var(--color-neutral-300);
      }
      :host-context(.dark) .chip-live {
        background: var(--color-error-900);
        color: var(--color-error-300);
      }
      :host-context(.dark) .chip-presence {
        background: color-mix(in srgb, var(--color-accent-500) 18%, transparent);
        color: var(--color-accent-300);
      }
      :host-context(.dark) .chip-neutral {
        background: var(--color-neutral-700);
        color: var(--color-neutral-200);
      }
      :host-context(.dark) .chip-primary {
        background: var(--color-primary-900);
        color: var(--color-primary-300);
      }
      :host-context(.dark) .chip-gold {
        background: color-mix(in srgb, var(--color-gold-500) 20%, transparent);
        color: var(--color-gold-300);
      }
      :host-context(.dark) .chip-streak {
        background: color-mix(in srgb, var(--color-gold-500) 20%, transparent);
        color: var(--color-gold-300);
      }
      :host-context(.dark) .chip-online {
        background: var(--color-accent-900);
        color: var(--color-accent-300);
      }

      .modal-body {
        padding: var(--space-3) var(--space-4) var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        /* Scroll inside the modal body when content overflows the 85dvh host cap. */
        overflow-y: auto;
        overscroll-behavior: contain;
      }

      .detail-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .detail-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        animation: itemIn 0.2s ease-out backwards;
      }

      .detail-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: var(--radius-md);
        background: var(--color-neutral-100);
        color: var(--color-neutral-500);
        flex-shrink: 0;
      }
      .detail-icon.gold-icon {
        background: var(--color-gold-50);
        color: var(--color-gold-600);
      }
      :host-context(.dark) .detail-icon {
        background: var(--color-neutral-700);
        color: var(--color-neutral-400);
      }
      :host-context(.dark) .detail-icon.gold-icon {
        background: color-mix(in srgb, var(--color-gold-800) 50%, transparent);
        color: var(--color-gold-400);
      }

      .detail-content {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px;
        font-size: var(--text-xs);
      }

      .detail-text {
        color: var(--color-text);
      }
      .detail-text.muted {
        color: var(--color-text-muted);
        font-size: var(--text-2xs);
      }
      :host-context(.dark) .detail-text { color: var(--color-neutral-100); }
      :host-context(.dark) .detail-text.muted { color: var(--color-neutral-400); }

      .tags-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        animation: itemIn 0.2s ease-out 0.05s backwards;
      }

      .tag {
        display: inline-flex;
        align-items: center;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: var(--radius-full);
        background: var(--color-neutral-100);
        color: var(--color-text-secondary);
        border: 1px solid var(--color-neutral-200);
      }
      :host-context(.dark) .tag {
        background: var(--color-neutral-700);
        color: var(--color-neutral-300);
        border-color: var(--color-neutral-600);
      }

      .links-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding-top: var(--space-1);
        animation: itemIn 0.2s ease-out 0.1s backwards;
      }

      .remark-chip {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        font-style: italic;
      }

      .profile-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--text-xs);
        color: var(--color-primary-600);
        text-decoration: none;
        font-weight: var(--font-medium);
      }
      .profile-link:hover {
        color: var(--color-primary-700);
        text-decoration: underline;
      }
      :host-context(.dark) .profile-link { color: var(--color-primary-300); }
      :host-context(.dark) .profile-link:hover { color: var(--color-primary-200); }

      .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-4) 0;
      }
      .empty-text {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        margin: 0;
        font-style: italic;
      }
      :host-context(.dark) .empty-text { color: var(--color-neutral-400); }

      .loading-state {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .skeleton-row {
        display: flex;
        gap: var(--space-2);
      }
      .skeleton-chip {
        height: 22px;
        width: 64px;
        border-radius: var(--radius-full);
        background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.4s infinite;
      }
      .skeleton-chip--lg { width: 100px; }
      :host-context(.dark) .skeleton-chip {
        background: linear-gradient(90deg, var(--color-neutral-700) 25%, var(--color-neutral-600) 50%, var(--color-neutral-700) 75%);
        background-size: 200% 100%;
      }
      @media (prefers-reduced-motion: reduce) {
        .skeleton-chip { animation: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .detail-row, .tags-row, .links-row { animation: none; }
      }

      .follow-action-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-4) 0;
        animation: itemIn 0.2s ease-out 0.1s backwards;
      }

      .follow-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 14px;
        border-radius: var(--radius-full);
        border: 1.5px solid var(--color-primary, #4F46E5);
        background: var(--color-primary, #4F46E5);
        color: #fff;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        cursor: pointer;
        transition: background 0.15s, opacity 0.15s, border-color 0.15s;
      }
      .follow-btn:hover:not(:disabled) {
        background: var(--color-primary-700, #4338ca);
        border-color: var(--color-primary-700, #4338ca);
      }
      .follow-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: 2px;
      }
      .follow-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .follow-btn--following {
        background: transparent;
        color: var(--color-primary, #4F46E5);
      }
      .follow-btn--following:hover:not(:disabled) {
        background: var(--color-primary-50);
        border-color: var(--color-primary, #4F46E5);
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .spin { animation: spin 0.8s linear infinite; }
    `,
  ],
})
export class UserInfoModalComponent {
  readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly data = inject<UserInfoModalData>(DIALOG_DATA);
  private readonly userInfoService = inject(UserInfoService);
  private readonly followService = inject(FollowService);
  private readonly toast = inject(ToastService);
  private readonly authStore = inject(AuthStore);

  constructor() {
    this.userInfoService.ensureFresh(this.data.userId);
    // Fetch presence independently — even a cached userInfo doesn't tell us where they
    // are right now. Re-fetches every 60s via the service's own staleness check.
    void this.userInfoService.fetchUserPresence(this.data.userId);
    // When presence says we're in someone else's room (statusType=2), fetch the host's
    // profile on demand so the banner can show their avatar + name. Reuses the existing
    // 5-minute userInfoService cache.
    effect(() => {
      const p = this.presence();
      if (p?.statusType === 2 && p.hostId > 0 && p.hostId !== this.data.userId) {
        void this.userInfoService.fetchUserInfo(p.hostId);
      }
    });
    // Also fetch the viewer's own presence (independent of the modal target's).
    // The banner uses this to decide whether the viewer is in the same room as
    // the modal target — and only then hide the join buttons. The viewer's
    // presence is cached for 60s in userInfoService so repeat modal opens are
    // cheap; the user's auth state is the only source-of-truth for "am I in a
    // room right now" we have at the global layer (RoomStore is component-scoped
    // and not available from the modal).
    const me = this.viewerId();
    if (me) void this.userInfoService.fetchUserPresence(me);
  }

  /** The viewer's own current room cname (or null if they're not in any room).
   *  Drives the banner's "you're in this room" state — the only true
   *  check is cname equality, regardless of role/host/guest. */
  readonly viewerCname = computed(() => {
    const me = this.viewerId();
    if (!me) return null;
    return this.userInfoService.getUserPresence(me)?.cname ?? null;
  });

  readonly hostInfo = computed<UserInfo | null>(() => {
    const p = this.presence();
    if (!p || p.statusType !== 2 || p.hostId <= 0) return null;
    if (p.hostId === this.data.userId) return null;
    return this.userInfoService.getUserInfo(p.hostId);
  });

  /** Current viewer's user id — used by the banner to decide whether to hide
   *  the join buttons (when the viewer is already in the same room the banner
   *  describes). */
  readonly viewerId = computed(() => this.authStore.user()?.userId ?? null);

  private readonly info = computed(() => this.userInfoService.getUserInfo(this.data.userId));
  private readonly details = computed(() => this.info()?.details ?? null);
  private readonly profileBase = computed(() => this.details()?.base ?? null);
  private readonly privileges = computed(() => this.details()?.privileges ?? null);

  readonly isLoading = computed(() => this.userInfoService.loading() && !this.info());

  readonly displayName = computed(() => this.info()?.nickname ?? this.data.nickname ?? 'User');
  readonly avatarUrl = computed(() => this.profileBase()?.headUrl || this.data.headUrl || '');
  readonly initials = computed(() => this.displayName().slice(0, 2));

  readonly username = computed(() => this.info()?.username ?? null);
  readonly signature = computed(() => this.profileBase()?.signature ?? null);
  readonly nationality = computed(() => this.info()?.nationality ?? this.data.nationality ?? null);
  readonly sex = computed(() => this.info()?.sex ?? null);
  readonly nativeLang = computed(() => this.profileBase()?.nativeLang ?? null);
  readonly learnLangs = computed(() => this.profileBase()?.learnLangs ?? []);
  readonly vipType = computed(() => this.profileBase()?.vipType ?? 0);
  readonly streakDays = computed(() => this.details()?.default?.consecutiveDays || null);

  private readonly hideAge = computed(() => this.privileges()?.hideAge === 1);
  private readonly hideCity = computed(() => this.privileges()?.hideCity === 1);
  private readonly hideLocation = computed(() => this.privileges()?.hideLocation === 1);
  private readonly hideOnline = computed(() => this.privileges()?.hideOnline === 1);
  private readonly hideLiveStatus = computed(() => this.privileges()?.hideLiveStatus === 1);

  readonly age = computed(() => (this.hideAge() ? null : this.info()?.age ?? null));
  readonly regDays = computed(() => this.info()?.regDays ?? null);

  readonly coverImageUrl = computed(() =>
    this.hideLocation() ? null : this.details()?.location?.mapImageUrl || null,
  );

  readonly location = computed(() => {
    if (this.hideCity() || this.hideLocation()) return null;
    const loc = this.details()?.location;
    const parts = [loc?.city, loc?.fullCountry].filter((p): p is string => !!p);
    return parts.length ? parts.join(', ') : null;
  });

  readonly hasLocationMeta = computed(
    () => !!(this.nationality() || this.location() || this.age() || this.regDays() != null),
  );

  readonly onlineStatus = computed(() => {
    if (this.hideOnline()) return null;
    const s = this.details()?.onlineState?.onlineState;
    if (s == null) return null;
    return s === 1 ? 'Online' : 'Offline';
  });

  // Where this user is right now — null until the presence fetch resolves.
  readonly presence = computed(() => this.userInfoService.getUserPresence(this.data.userId));
  /** Human-readable summary: "Hosting: <room>", "In: <room>", or null if offline/blackened. */
  readonly shouldShowBanner = computed(() => {
    const p = this.presence();
    return !!p && !p.blackened && (p.statusType === 1 || p.statusType === 2);
  });

  readonly presenceLabel = computed(() => {
    if (this.shouldShowBanner()) return null;  // banner takes over when present
    const p = this.presence();
    if (!p || p.blackened) return null;
    if (p.statusType === 1) {
      return p.roomName?.trim() ? `Hosting: ${p.roomName}` : 'Hosting a room';
    }
    if (p.statusType === 2) {
      return p.roomName?.trim() ? `In: ${p.roomName}` : 'In a room';
    }
    return null;
  });
  readonly onlineChipClass = computed(() =>
    this.onlineStatus() === 'Online' ? 'chip-online' : 'chip-offline',
  );

  readonly liveStatus = computed(() => {
    if (this.hideLiveStatus()) return null;
    const s = this.details()?.liveState?.statusType;
    return s != null && s > 0;
  });

  readonly relationStats = computed(() => {
    const relation = this.details()?.relation;
    if (!relation) return null;
    return {
      followers: relation.followers ?? 0,
      following: relation.following ?? 0,
      moments: relation.moments ?? 0,
      likes: relation.likes ?? 0,
    };
  });

  readonly tagChips = computed<readonly string[]>(() => this.info()?.tags ?? []);

  readonly giftLevel = computed(() => this.details()?.giftLevel ?? null);

  readonly pointsSummary = computed(() => {
    const total = this.info()?.pointsTotal;
    if (!total) return null;
    return total > 0 ? total.toLocaleString() : null;
  });

  readonly remarkName = computed(() => this.details()?.remark?.remarkName ?? null);
  readonly profileUrl = computed(() => this.details()?.default?.profileShareUrl ?? null);

  // ── Follow state ─────────────────────────────────────────────────────────────
  //
  // The upstream profile-enrichment endpoint (`/profile/v2/userinfo`, which backs
  // UserInfoService) has no follow/mutual field in its `relation` payload — verified
  // against jilalibff's UserInfoResponse.RelationInfo, which only carries counts
  // (followers, following, likes, ...). There's also no per-arbitrary-user
  // "am I following them" lookup anywhere in the captured HelloTalk traffic; that
  // signal only shows up contextually, on room-list and end-page-audience payloads.
  // So the initial state here is genuinely unknown — `null` — and the only truth we
  // ever get is the toggle response's `data.status` (1 = now following, 0 = not),
  // which becomes the definitive state for the rest of this modal's lifetime.

  private readonly _isFollowing = signal<boolean | null>(null);
  private readonly _isTogglingFollow = signal(false);

  readonly isFollowing = this._isFollowing.asReadonly();
  readonly isTogglingFollow = this._isTogglingFollow.asReadonly();

  /** True when the current user is NOT viewing their own profile. */
  readonly canFollow = computed(() => {
    const me = this.authStore.user();
    const targetId = this.data.userId;
    return me != null && me.userId !== targetId;
  });

  readonly followBtnLabel = computed(() => {
    if (this.isTogglingFollow()) return '…';
    return this.isFollowing() ? 'Following' : 'Follow';
  });

  async toggleFollow(): Promise<void> {
    const uid = this.data.userId;
    const nick = this.displayName();
    if (this._isTogglingFollow()) return;

    // follow()/unfollow() are separate, non-toggling upstream calls (see FollowService's
    // doc) — which one to send depends on the state we're currently in.
    const request$ = this.isFollowing()
      ? this.followService.unfollow(uid, nick)
      : this.followService.follow(uid, nick);

    this._isTogglingFollow.set(true);
    try {
      const result = await firstValueFrom(request$);
      if (result.status === 0) {
        this._isFollowing.set(result.data?.status === 1);
      } else {
        this.toast.error(result.message || 'Could not update follow status. Please try again.');
      }
    } catch (err) {
      this.toast.error(httpErrorMessage(err, 'Could not update follow status. Please try again.'));
    } finally {
      this._isTogglingFollow.set(false);
    }
  }

  // Room-presence banner join handlers — see RoomPresenceBannerComponent for the trigger.
  private readonly router = inject(Router);
  private readonly isJoining = signal(false);

  async joinRoom(visible: boolean): Promise<void> {
    if (this.isJoining()) return;                  // re-entry guard: double-click safety
    const p = this.presence();
    if (!p?.cname) return;
    const busiType = cnameToBusiType(p.cname);
    if (busiType === null) return;                 // unknown prefix — refuse the navigate
    this.isJoining.set(true);
    try {
      this.ref.close();                            // close modal first so the room page
                                                  // mounts cleanly on a fresh navigation
      const path = busiType === 1 ? '/room/video' : '/room';
      const queryParams = visible ? {} : { visible: 'false' };
      await this.router.navigate([path, p.cname, busiType], { queryParams });
    } finally {
      this.isJoining.set(false);
    }
  }
}
