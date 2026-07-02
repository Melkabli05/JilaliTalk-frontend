import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ModAction } from './mod-store';
import { UserRole } from '@core/models/user-role';
import { UserInfoService } from '@core/services/user-info.service';
import { PermissionsService } from '@core/services/permissions.service';
import { BaseRoomStore } from '../../state/base-room-store';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import {
  LucideCrown,
  LucideExternalLink,
  LucideX,
} from '@lucide/angular';
import { initialsFrom } from '@shared/utils';

export interface UserActionModalData {
  readonly userId?: number;
  readonly nickname?: string | null;
  readonly headUrl?: string | null;
  readonly base?: { headUrl?: string | null; nickname?: string | null };
  readonly role?: number;
  readonly isRaiseHand?: boolean;
  readonly isTurnOnMic?: boolean;
  readonly isGhost?: boolean;
  readonly myRole?: UserRole;
  readonly myUserId?: number;
}

@Component({
  selector: 'app-user-action-modal',
  imports: [
    ModalComponent,
    AvatarComponent,
    CountryFlagComponent,
    LanguageTagComponent,
    LucideCrown,
    LucideExternalLink,
    LucideX,
  ],
  providers: [PermissionsService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [noPadding]="true">
      <div class="modal-header">
        <button type="button" class="close-btn" (click)="ref.close()" aria-label="Close">
          <svg aria-hidden="true" lucideX [size]="14"></svg>
        </button>

        <div class="profile-row">
          <app-avatar
            [src]="avatarUrl()"
            [initials]="initials()"
            size="xl"
            [alt]="displayName()"
            [ringColor]="ringColor()"
            [crownType]="crownType()"
          />
          <div class="profile-info">
            <div class="name-row">
              <span class="user-name" id="user-action-title">{{ displayName() }}</span>
              @if (username()) {
                <span class="user-handle">&#64;{{ username() }}</span>
              }
            </div>
            <div class="meta-row">
              @if (vipType() === 100) {
                <span class="chip chip-gold"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
              } @else if (vipType() > 0 && vipType() < 100) {
                <span class="chip chip-primary"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
              }
              <span class="chip" [class]="roleChipClass()">{{ roleLabel() }}</span>
            </div>
          </div>
        </div>

        @if (signature()) {
          <p class="bio">{{ signature() }}</p>
        }
      </div>

      <div class="modal-body">

        @if (relationStats(); as stats) {
          <div class="stats-bar">
            <div class="stat-block">
              <span class="stat-val">{{ stats.followers }}</span>
              <span class="stat-lbl">Followers</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-block">
              <span class="stat-val">{{ stats.following }}</span>
              <span class="stat-lbl">Following</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-block">
              <span class="stat-val">{{ stats.moments }}</span>
              <span class="stat-lbl">Moments</span>
            </div>
          </div>
        }

        <div class="info-cards">
          @if (hasLocationMeta()) {
            <div class="info-card">
              <div class="info-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div class="info-card-content">
                <span class="info-card-label">From</span>
                <div class="info-card-value">
                  @if (nationality()) {
                    <app-country-flag [code]="nationality()" />
                  }
                  @if (location(); as loc) {
                    <span>{{ loc }}</span>
                  }
                  @if (age(); as a) {
                    <span class="chip chip-neutral">{{ a }} yo</span>
                  }
                  @if (regDays() != null) {
                    <span class="chip chip-neutral">{{ regDays() }}d</span>
                  }
                </div>
              </div>
            </div>
          }

          @if (nativeLang() || learnLangs().length) {
            <div class="info-card">
              <div class="info-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <div class="info-card-content">
                <span class="info-card-label">Languages</span>
                <div class="lang-tags">
                  @if (nativeLang(); as lang) {
                    <app-language-tag [langId]="lang" />
                  }
                  @if (learnLangs().length) {
                    <span class="lang-sep">learning</span>
                    @for (lang of learnLangs(); track lang.langId) {
                      <app-language-tag [langId]="lang.langId" />
                    }
                  }
                </div>
              </div>
            </div>
          }

          @if (onlineStatus() || liveStatus()) {
            <div class="info-card">
              <div class="info-card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div class="info-card-content">
                <span class="info-card-label">Status</span>
                <div class="info-card-value">
                  @if (onlineStatus(); as status) {
                    <span class="chip" [class]="onlineChipClass()">{{ status }}</span>
                  }
                  @if (liveStatus()) {
                    <span class="chip chip-live">LIVE</span>
                  }
                </div>
              </div>
            </div>
          }

          @if (giftLevel() || pointsSummary()) {
            <div class="info-card">
              <div class="info-card-icon gold-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div class="info-card-content">
                <span class="info-card-label">Activity</span>
                <div class="info-card-value">
                  @if (giftLevel(); as level) {
                    <span class="chip chip-gold">Gift {{ level }}</span>
                  }
                  @if (pointsSummary(); as pts) {
                    <span class="chip chip-neutral">{{ pts }} pts</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        @if (tagChips().length || remarkName() || profileUrl()) {
          <div class="extras-row">
            @if (remarkName(); as remark) {
              <span class="chip chip-neutral">&#64;{{ remark }}</span>
            }
            @if (tagChips().length) {
              @for (chip of tagChips(); track $index) {
                <span class="chip chip-neutral">{{ chip }}</span>
              }
            }
            @if (profileUrl(); as url) {
              <a class="chip chip-link" [href]="url" target="_blank" rel="noopener">
                <svg aria-hidden="true" lucideExternalLink [size]="9"></svg>Profile
              </a>
            }
          </div>
        }

      </div>

      <div class="modal-actions">
        @if (hasManageActions()) {
          <div class="action-group">
            <span class="group-label">Manage</span>
            <div class="action-list">
              @if (canMute()) {
                <button type="button" class="action-card" (click)="ref.close('mute')">
                  <div class="action-icon muted">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  </div>
                  <div class="action-text">
                    <span class="action-title">Mute microphone</span>
                    <span class="action-desc">Silence their mic</span>
                  </div>
                </button>
              }

              @if (canLowerHand() && isTargetRaiseHand()) {
                <button type="button" class="action-card" (click)="ref.close(isTargetSelf() ? 'raise_hand' : 'reject_raise_hand')">
                  <div class="action-icon neutral">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
                  </div>
                  <div class="action-text">
                    <span class="action-title">{{ isTargetSelf() ? 'Lower hand' : 'Reject hand' }}</span>
                    <span class="action-desc">{{ isTargetSelf() ? 'Put your hand down' : 'Deny the hand raise' }}</span>
                  </div>
                </button>
              }

              @if (isMyRoleHost()) {
                <button type="button" class="action-card" (click)="ref.close('add_manager')">
                  <div class="action-icon neutral">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  </div>
                  <div class="action-text">
                    <span class="action-title">Make moderator</span>
                    <span class="action-desc">Give them mod controls</span>
                  </div>
                </button>

                <button type="button" class="action-card" (click)="ref.close('invite_to_stage')">
                  <div class="action-icon neutral">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  </div>
                  <div class="action-text">
                    <span class="action-title">Invite to stage</span>
                    <span class="action-desc">Call them up to speak</span>
                  </div>
                </button>
              }

              @if (isMyRoleModerator()) {
                <button type="button" class="action-card" (click)="ref.close('remove_manager')">
                  <div class="action-icon neutral">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                  </div>
                  <div class="action-text">
                    <span class="action-title">Remove moderator</span>
                    <span class="action-desc">Strip their mod controls</span>
                  </div>
                </button>
              }
            </div>
          </div>
        }

        @if (canKick() || canBan()) {
          <div class="action-group danger-zone">
            <span class="group-label danger-label">Danger zone</span>
            <div class="action-list">
              @if (canKick()) {
                <button type="button" class="action-card action-card--danger" (click)="ref.close('kick')">
                  <div class="action-icon danger">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>
                  </div>
                  <div class="action-text">
                    <span class="action-title">Kick from room</span>
                    <span class="action-desc">Temporarily remove them</span>
                  </div>
                </button>
              }
              @if (canBan()) {
                <button type="button" class="action-card action-card--danger" (click)="ref.close('ban')">
                  <div class="action-icon danger">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  </div>
                  <div class="action-text">
                    <span class="action-title">Ban from room</span>
                    <span class="action-desc">Permanently block them</span>
                  </div>
                </button>
              }
            </div>
          </div>
        }
      </div>
    </app-modal>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 380px;
        max-width: calc(100vw - var(--space-8));
        --_modal-radius: var(--radius-2xl);
        animation: slideUp 0.2s ease-out;
        box-shadow: var(--shadow-modal);

        --uam-text:           var(--color-text);
        --uam-muted:          var(--color-text-muted);
        --uam-text-secondary: var(--color-text-secondary);
        --uam-border:         var(--color-border);
        --uam-card:           var(--color-card);
        --uam-header-bg:      var(--color-neutral-50);
        --uam-stats-bg:       var(--color-neutral-50);

        --uam-close-bg:        var(--color-neutral-100);
        --uam-close-bg-hover:  var(--color-neutral-200);
        --uam-close-fg:        var(--color-text-muted);

        --uam-chip-neutral-bg: var(--color-neutral-100);
        --uam-chip-neutral-fg: var(--color-text-secondary);
        --uam-chip-primary-bg: var(--color-primary-50);
        --uam-chip-primary-fg: var(--color-primary-600);
        --uam-chip-gold-bg:    var(--color-gold-50);
        --uam-chip-gold-fg:    var(--color-gold-600);
        --uam-chip-ghost-bg:   var(--color-neutral-700);
        --uam-chip-ghost-fg:   var(--color-neutral-100);
        --uam-chip-online-bg:  var(--color-accent-50);
        --uam-chip-online-fg:  var(--color-accent-600);
        --uam-chip-live-bg:    var(--color-error-50);
        --uam-chip-live-fg:    var(--color-error-600);
        --uam-chip-link-bg:       var(--color-primary-50);
        --uam-chip-link-bg-hover: var(--color-primary-100);
        --uam-chip-link-fg:       var(--color-primary-600);

        --uam-divider:         var(--color-border);
        --uam-card-hover-bg:   var(--color-neutral-50);
        --uam-card-hover-bd:   var(--color-neutral-300);

        --uam-danger-card-bg:        color-mix(in srgb, var(--color-error-50) 40%, var(--color-card));
        --uam-danger-card-bg-hover:  var(--color-error-50);
        --uam-danger-card-border:    color-mix(in srgb, var(--color-error-300) 40%, transparent);

        --uam-action-icon-muted-bg:   var(--color-warm-100);
        --uam-action-icon-muted-fg:   var(--color-warm-600);
        --uam-action-icon-neutral-bg: var(--color-primary-50);
        --uam-action-icon-neutral-fg: var(--color-primary-600);
        --uam-action-icon-danger-bg:  var(--color-error-50);
        --uam-action-icon-danger-fg:  var(--color-error-600);

        --uam-info-icon-bg:      var(--color-primary-50);
        --uam-info-icon-fg:      var(--color-primary-600);
        --uam-info-icon-gold-bg: var(--color-gold-50);
        --uam-info-icon-gold-fg: var(--color-gold-600);
      }
      :host-context(.dark) {
        --uam-text:           var(--color-neutral-100);
        --uam-muted:          var(--color-neutral-400);
        --uam-text-secondary: var(--color-neutral-200);
        --uam-border:         var(--color-neutral-700);
        --uam-card:           var(--color-neutral-800);
        --uam-header-bg:      var(--color-neutral-800);
        --uam-stats-bg:       var(--color-neutral-800);

        --uam-close-bg:        var(--color-neutral-700);
        --uam-close-bg-hover:  var(--color-neutral-600);
        --uam-close-fg:        var(--color-neutral-300);

        --uam-chip-neutral-bg: var(--color-neutral-700);
        --uam-chip-neutral-fg: var(--color-neutral-200);
        --uam-chip-primary-bg: var(--color-primary-900);
        --uam-chip-primary-fg: var(--color-primary-300);
        --uam-chip-gold-bg:    var(--color-gold-900);
        --uam-chip-gold-fg:    var(--color-gold-300);
        --uam-chip-ghost-bg:   var(--color-neutral-800);
        --uam-chip-ghost-fg:   var(--color-neutral-100);
        --uam-chip-online-bg:  var(--color-accent-900);
        --uam-chip-online-fg:  var(--color-accent-300);
        --uam-chip-live-bg:    var(--color-error-900);
        --uam-chip-live-fg:    var(--color-error-300);
        --uam-chip-link-bg:       var(--color-primary-900);
        --uam-chip-link-bg-hover: var(--color-primary-800);
        --uam-chip-link-fg:       var(--color-primary-300);

        --uam-divider:        var(--color-neutral-700);
        --uam-card-hover-bg:  var(--color-neutral-700);
        --uam-card-hover-bd:  var(--color-neutral-600);

        --uam-danger-card-bg:        color-mix(in srgb, var(--color-error-900) 30%, var(--color-card));
        --uam-danger-card-bg-hover:  color-mix(in srgb, var(--color-error-900) 50%, var(--color-card));
        --uam-danger-card-border:    var(--color-error-700);

        --uam-action-icon-muted-bg:   var(--color-warm-900);
        --uam-action-icon-muted-fg:   var(--color-warm-300);
        --uam-action-icon-neutral-bg: var(--color-primary-900);
        --uam-action-icon-neutral-fg: var(--color-primary-300);
        --uam-action-icon-danger-bg:  var(--color-error-900);
        --uam-action-icon-danger-fg:  var(--color-error-300);

        --uam-info-icon-bg:      var(--color-primary-900);
        --uam-info-icon-fg:      var(--color-primary-300);
        --uam-info-icon-gold-bg: var(--color-gold-900);
        --uam-info-icon-gold-fg: var(--color-gold-300);
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        :host { animation: none; }
      }

      .modal-header {
        position: relative;
        padding: var(--space-5) var(--space-4) var(--space-4);
        background: var(--uam-header-bg);
        border-bottom: 1px solid var(--uam-border);
      }

      .close-btn {
        position: absolute;
        top: var(--space-3);
        right: var(--space-3);
        width: 28px;
        height: 28px;
        border-radius: var(--radius-full);
        border: none;
        background: var(--uam-close-bg);
        color: var(--uam-close-fg);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s, transform 0.15s;
      }
      .close-btn:hover {
        background: var(--uam-close-bg-hover);
        color: var(--uam-text);
        transform: rotate(90deg);
      }
      .close-btn:focus-visible {
        outline: var(--focus-ring);
        outline-offset: 2px;
      }

      .profile-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-2);
      }

      .profile-info {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-width: 0;
      }

      .name-row {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .user-name {
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--uam-text);
      }

      .user-handle {
        font-size: var(--text-xs);
        color: var(--uam-muted);
      }

      .meta-row {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        flex-wrap: wrap;
      }

      .bio {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--uam-muted);
        line-height: 1.5;
      }

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
        background: var(--uam-chip-neutral-bg);
        color: var(--uam-chip-neutral-fg);
      }
      .chip-primary,
      .chip-mod {
        background: var(--uam-chip-primary-bg);
        color: var(--uam-chip-primary-fg);
      }
      .chip-gold,
      .chip-host {
        background: var(--uam-chip-gold-bg);
        color: var(--uam-chip-gold-fg);
      }
      .chip-ghost {
        background: var(--uam-chip-ghost-bg);
        color: var(--uam-chip-ghost-fg);
      }
      .chip-online {
        background: var(--uam-chip-online-bg);
        color: var(--uam-chip-online-fg);
      }
      .chip-offline {
        background: var(--uam-chip-neutral-bg);
        color: var(--uam-muted);
      }
      .chip-live {
        background: var(--uam-chip-live-bg);
        color: var(--uam-chip-live-fg);
      }
      .chip-link {
        background: var(--uam-chip-link-bg);
        color: var(--uam-chip-link-fg);
        text-decoration: none;
        cursor: pointer;
        transition: background 0.15s;
      }
      .chip-link:hover { background: var(--uam-chip-link-bg-hover); }

      .modal-body {
        padding: var(--space-3) var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .stats-bar {
        display: flex;
        align-items: center;
        background: var(--uam-stats-bg);
        border: 1px solid var(--uam-border);
        border-radius: var(--radius-lg);
        padding: var(--space-3) var(--space-2);
      }

      .stat-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        gap: 1px;
      }

      .stat-divider {
        width: 1px;
        height: 28px;
        background: var(--uam-divider);
        flex-shrink: 0;
      }

      .stat-val {
        font-size: var(--text-base);
        font-weight: var(--font-bold);
        color: var(--uam-text);
      }

      .stat-lbl {
        font-size: var(--text-2xs);
        color: var(--uam-muted);
      }

      .info-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-2);
      }

      .info-card {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: var(--uam-card);
        border: 1px solid var(--uam-border);
        border-radius: var(--radius-lg);
      }

      .info-card-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: var(--radius-md);
        background: var(--uam-info-icon-bg);
        color: var(--uam-info-icon-fg);
        flex-shrink: 0;
        margin-top: 1px;
      }
      .info-card-icon.gold-icon {
        background: var(--uam-info-icon-gold-bg);
        color: var(--uam-info-icon-gold-fg);
      }

      .info-card-content {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      .info-card-label {
        font-size: var(--text-2xs);
        font-weight: var(--font-semibold);
        color: var(--uam-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .info-card-value {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 3px;
        font-size: var(--text-xs);
        color: var(--uam-text);
      }

      .lang-tags {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 3px;
      }

      .lang-sep {
        font-size: var(--text-2xs);
        color: var(--uam-muted);
        font-style: italic;
      }

      .extras-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        padding-top: var(--space-1);
      }

      .modal-actions {
        padding: var(--space-3) var(--space-4);
        border-top: 1px solid var(--uam-border);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .action-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .group-label {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--uam-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 0 var(--space-1);
      }

      .danger-label {
        color: var(--color-error-500);
      }
      :host-context(.dark) .danger-label { color: var(--color-error-400); }

      .action-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .action-card {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        width: 100%;
        padding: var(--space-3);
        border-radius: var(--radius-lg);
        border: 1px solid var(--uam-border);
        background: var(--uam-card);
        cursor: pointer;
        text-align: left;
        transition:
          background 0.15s,
          border-color 0.15s,
          transform 0.1s;
      }
      .action-card:hover {
        background: var(--uam-card-hover-bg);
        border-color: var(--uam-card-hover-bd);
        transform: translateX(2px);
      }
      .action-card:active { transform: translateX(0); }
      .action-card:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }

      .action-card--danger {
        border-color: var(--uam-danger-card-border);
        background: var(--uam-danger-card-bg);
      }
      .action-card--danger:hover {
        background: var(--uam-danger-card-bg-hover);
        border-color: var(--color-error-300);
      }

      .action-icon {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .action-icon.muted {
        background: var(--uam-action-icon-muted-bg);
        color: var(--uam-action-icon-muted-fg);
      }
      .action-icon.neutral {
        background: var(--uam-action-icon-neutral-bg);
        color: var(--uam-action-icon-neutral-fg);
      }
      .action-icon.danger {
        background: var(--uam-action-icon-danger-bg);
        color: var(--uam-action-icon-danger-fg);
      }

      .action-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        flex: 1;
        min-width: 0;
      }

      .action-title {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--uam-text);
      }
      .action-desc {
        font-size: var(--text-xs);
        color: var(--uam-muted);
        line-height: 1.4;
      }
      .action-card--danger .action-title { color: var(--color-error-600); }
      :host-context(.dark) .action-card--danger .action-title { color: var(--color-error-400); }
    `,
  ],
})
export class UserActionModalComponent {
  readonly ref = inject<DialogRef<ModAction | undefined>>(DialogRef);
  private readonly data = inject<UserActionModalData>(DIALOG_DATA);
  private readonly userInfoService = inject(UserInfoService);
  private readonly roomStore = inject(BaseRoomStore, { optional: true });
  private readonly permissionsService = inject(PermissionsService);

  readonly UserRole = UserRole;

  constructor() {
    const uid = this.data.userId;
    if (uid && !this.userInfoService.getUserInfo(uid)) {
      void this.userInfoService.fetchUserInfo(uid);
    }
  }

  private readonly info = computed(() => {
    const uid = this.data.userId;
    return uid != null ? this.userInfoService.getUserInfo(uid) : null;
  });
  private readonly details = computed(() => this.info()?.details ?? null);
  private readonly profileBase = computed(() => this.details()?.base ?? null);

  readonly displayName = computed(
    () => this.info()?.nickname ?? this.data.nickname ?? this.data.base?.nickname ?? 'User',
  );
  readonly avatarUrl = computed(
    () => this.profileBase()?.headUrl || this.data.headUrl || this.data.base?.headUrl || '',
  );
  readonly initials = computed(() => initialsFrom(this.displayName()));

  readonly username = computed(() => this.info()?.username ?? null);
  readonly signature = computed(() => this.profileBase()?.signature ?? null);
  readonly nationality = computed(() => this.info()?.nationality ?? null);
  readonly age = computed(() => this.info()?.age ?? null);
  readonly regDays = computed(() => this.info()?.regDays ?? null);
  readonly nativeLang = computed(() => this.profileBase()?.nativeLang ?? null);
  readonly learnLangs = computed(() => this.profileBase()?.learnLangs ?? []);
  readonly vipType = computed(() => this.profileBase()?.vipType ?? 0);

  readonly location = computed(() => {
    const loc = this.details()?.location;
    const parts = [loc?.city, loc?.fullCountry].filter((p): p is string => !!p);
    return parts.length ? parts.join(', ') : null;
  });

  readonly hasLocationMeta = computed(
    () => !!(this.nationality() || this.location() || this.age() || this.regDays() != null),
  );

  readonly onlineStatus = computed(() => {
    const s = this.details()?.onlineState?.onlineState;
    if (s == null) return null;
    return s === 1 ? 'Online' : 'Offline';
  });
  readonly onlineChipClass = computed(() =>
    this.onlineStatus() === 'Online' ? 'chip-online' : 'chip-offline',
  );

  readonly liveStatus = computed(() => {
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
    };
  });

  readonly tagChips = computed<readonly string[]>(() => {
    const tags = this.details()?.tags;
    if (!tags) return [];
    return [
      ...(tags.hobby ?? []),
      ...(tags.mbti ?? []),
      ...(tags.zodiacSign ?? []),
      ...(tags.bloodType ?? []),
    ]
      .map((t) => t.tag ?? '')
      .filter((tag) => tag.length > 0);
  });

  readonly giftLevel = computed(() => this.details()?.giftLevel ?? null);

  readonly pointsSummary = computed(() => {
    const p = this.details()?.points;
    if (!p) return null;
    const total =
      (p.correct ?? 0) +
      (p.translate ?? 0) +
      (p.word ?? 0) +
      (p.speechToText ?? 0) +
      (p.textTranslate ?? 0) +
      (p.transliterate ?? 0);
    return total > 0 ? total.toLocaleString() : null;
  });

  readonly remarkName = computed(() => this.details()?.remark?.remarkName ?? null);
  readonly profileUrl = computed(() => this.details()?.default?.profileShareUrl ?? null);

  readonly roleLabel = computed(() => {
    if (this.data.isGhost) return 'Ghost (Invisible)';
    switch (this.data.role) {
      case UserRole.Host:
        return 'Host';
      case UserRole.Moderator:
        return 'Moderator';
      default:
        return 'Listener';
    }
  });
  readonly roleChipClass = computed(() => {
    if (this.data.isGhost) return 'chip-ghost';
    switch (this.data.role) {
      case UserRole.Host:
        return 'chip-host';
      case UserRole.Moderator:
        return 'chip-mod';
      default:
        return 'chip-neutral';
    }
  });
  readonly crownType = computed(() => {
    switch (this.data.role) {
      case UserRole.Host:
        return 1;
      case UserRole.Moderator:
        return 2;
      default:
        return null;
    }
  });
  readonly ringColor = computed(() => {
    switch (this.data.role) {
      case UserRole.Host:
        return 'var(--color-gold-400)';
      case UserRole.Moderator:
        return 'var(--color-primary-300)';
      default:
        return 'var(--color-border)';
    }
  });

  readonly targetRole = computed(
    () => (this.data.role as UserRole) ?? UserRole.Normal,
  );

  readonly isTargetRaiseHand = computed(() => this.data.isRaiseHand ?? false);

  readonly myRole = computed(
    () => this.roomStore?.myRole() ?? this.data.myRole ?? UserRole.Normal,
  );

  readonly isTargetSelf = computed(
    () =>
      this.data.userId != null &&
      this.data.userId === (this.roomStore?.userId() ?? this.data.myUserId),
  );

  private readonly permissions = computed(() =>
    this.permissionsService.forTarget(this.targetRole(), this.myRole(), this.isTargetSelf()),
  );

  readonly canMute = computed(
    () => this.permissions().canMute && (this.data.isTurnOnMic ?? false),
  );
  readonly canKick = computed(() => this.permissions().canKick);
  readonly canBan = computed(() => this.permissions().canBan);
  readonly canLowerHand = computed(() => this.permissions().canLowerHand);
  readonly isMyRoleHost = computed(() => this.myRole() === UserRole.Host);
  readonly isMyRoleModerator = computed(() => this.myRole() === UserRole.Moderator);

  readonly hasManageActions = computed(
    () =>
      this.canMute() ||
      (this.canLowerHand() && this.isTargetRaiseHand()) ||
      this.isMyRoleHost() ||
      this.isMyRoleModerator(),
  );

  readonly isTargetModerator = computed(() => this.targetRole() === UserRole.Moderator);
  readonly isTargetHost = computed(() => this.targetRole() === UserRole.Host);
}
