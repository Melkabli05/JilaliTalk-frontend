import { Component, ChangeDetectionStrategy, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { UserInfoService, type UserInfo } from '@core/services/user-info.service';
import { FollowService } from '@core/services/follow.service';
import { ToastService } from '@core/services/toast.service';
import { AuthStore } from '@core/auth/auth.store';
import { ActiveCallStore } from '@store/active-call.store';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { UserIdentityCardComponent } from '@shared/ui/user-identity-card/user-identity-card.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { RoomPresenceBannerComponent } from '@shared/ui/room-presence-banner';
import { cnameToBusiType } from '@shared/utils';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';
import { LucideX, LucideCrown, LucideUserPlus, LucideUserCheck, LucideLoader, LucideMessageCircle, LucideHeartHandshake } from '@lucide/angular';

export interface UserInfoModalData {
  readonly userId: number;
  readonly nickname?: string | null;
  readonly headUrl?: string | null;
  readonly nationality?: string | null;
  /** Seeds the follow button's initial state when the caller already knows it
   *  (e.g. the profile page's Followers/Following tabs, which fetch `is_mutual`
   *  per row). Omit when unknown — the modal falls back to `null` (unknown)
   *  and the button reads "Follow" until the user actually toggles it. */
  readonly isFollowing?: boolean | null;
  /** Mutual/friend status — true when the viewer and target follow each other. Shows the
   *  "Partner" chip. Same meaning as the profile page's Followers/Following tabs'
   *  `SocialUser.isMutual`. */
  readonly isMutual?: boolean | null;
  /** Room context (cname + busiType) for the target user, when the caller has one and
   *  `isFollowing`/`isMutual` weren't already known. Lets the modal fetch the room-scoped
   *  follow status itself via `UserInfoService.fetchRoomFollowStatus` (the one upstream call
   *  that exposes the viewer's follow relation to an arbitrary user) instead of starting
   *  unknown. Ignored when `isFollowing` is already set. */
  readonly roomContext?: { readonly cname: string; readonly busiType: number } | null;
}

const CHIP_BASE =
  'inline-flex items-center gap-[3px] text-[10px] font-semibold py-0.5 px-1.5 rounded-full whitespace-nowrap';

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
    LucideHeartHandshake,
    LucideMessageCircle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex flex-col w-[340px] max-w-[calc(100vw-2rem)] max-h-[85dvh] shadow-2xl ' +
      'animate-[slideUp_0.2s_ease-out] motion-reduce:animate-none',
  },
  template: `
    <app-modal [noPadding]="true">
      <button
        type="button"
        class="absolute top-3 right-3 w-11 h-11 rounded-full border-0 bg-neutral-100 dark:bg-neutral-700
               text-neutral-500 dark:text-neutral-300 cursor-pointer [touch-action:manipulation]
               [-webkit-tap-highlight-color:transparent] flex items-center justify-center z-[1]
               transition-[background-color,transform] duration-150
               hover:bg-neutral-200 hover:text-neutral-900 hover:rotate-90
               dark:hover:bg-neutral-600 dark:hover:text-neutral-100
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        (click)="ref.close()"
        aria-label="Close"
      >
        <svg aria-hidden="true" lucideX [size]="14"></svg>
      </button>

      <div
        class="flex flex-col max-h-[46dvh] overflow-y-auto [overscroll-behavior:contain] [scroll-padding-top:0.5rem]
               [mask-image:linear-gradient(to_bottom,black_80%,transparent_100%)]
               [-webkit-mask-image:linear-gradient(to_bottom,black_80%,transparent_100%)]"
      >
        <div
          class="pt-[calc(26px+0.75rem)] bg-white dark:bg-neutral-800 rounded-t-lg shrink-0
                 animate-[itemIn_0.25s_ease-out_backwards] motion-reduce:animate-none"
        >
          <app-user-identity-card
            [avatarUrl]="avatarUrl()"
            [initials]="initials()"
            [displayName]="displayName()"
            [username]="username()"
            [signature]="signature()"
            [ringColor]="vipType() === 100 ? '#fcd34d' : '#93c5fd'"
            [vip]="vipType() === 100"
          >
            @if (sex() === 'male') {
              <span nameBadge class="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0
                                     bg-[hsl(230_28%_90%)] text-[hsl(230_28%_45%)]
                                     dark:bg-[hsl(230_20%_25%)] dark:text-[hsl(230_20%_60%)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="14.5" r="5.5"/><path d="M19.5 8 12 15.5M19.5 8l-5.5 0"/></svg>
              </span>
            } @else if (sex() === 'female') {
              <span nameBadge class="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0
                                     bg-[hsl(10_32%_90%)] text-[hsl(10_32%_45%)]
                                     dark:bg-[hsl(10_20%_25%)] dark:text-[hsl(10_20%_60%)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="14.5" cy="8" r="5.5"/><path d="M14.5 8 12 5.5M14.5 8h-5M12 5.5v8"/></svg>
              </span>
            }
            <ng-container metaChips>
              @if (vipType() === 100) {
                <span class="{{ CHIP_BASE }} bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
              } @else if (vipType() > 0 && vipType() < 100) {
                <span class="{{ CHIP_BASE }} bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
              }
              @if (isMutual()) {
                <span class="{{ CHIP_BASE }} bg-pink-50 text-pink-600 dark:bg-pink-500/20 dark:text-pink-300"><svg aria-hidden="true" lucideHeartHandshake [size]="9"></svg>Partner</span>
              }
              @if (onlineStatus(); as status) {
                <span [class]="onlineChipClass()">{{ status }}</span>
              }
              @if (liveStatus()) {
                <span class="{{ CHIP_BASE }} bg-red-50 text-red-600 dark:bg-red-900 dark:text-red-300">LIVE</span>
              }
              @if (presenceLabel(); as label) {
                <span class="{{ CHIP_BASE }} bg-emerald-50 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300">{{ label }}</span>
              }
              @if (streakDays(); as streak) {
                <span class="{{ CHIP_BASE }} bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">{{ streak }}-day streak</span>
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
          <div class="flex items-center gap-2 pt-2 px-4 animate-[itemIn_0.2s_ease-out_0.1s_backwards] motion-reduce:animate-none">
            <button
              type="button"
              class="inline-flex items-center gap-[5px] py-1.5 px-3.5 rounded-full border-[1.5px] border-blue-500
                     bg-blue-500 text-white text-xs font-semibold cursor-pointer
                     transition-[background-color,opacity,border-color] duration-150
                     not-disabled:hover:bg-blue-600 not-disabled:hover:border-blue-600
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                     disabled:opacity-60 disabled:cursor-not-allowed"
              (click)="sendMessage()"
              aria-label="Send message to {{ displayName() }}"
            >
              <svg aria-hidden="true" lucideMessageCircle [size]="14"></svg>
              Message
            </button>
            <button
              type="button"
              [class]="followBtnClass()"
              [disabled]="isTogglingFollow()"
              (click)="toggleFollow()"
              [attr.aria-label]="followBtnLabel()"
            >
              @if (isTogglingFollow()) {
                <svg aria-hidden="true" lucideLoader [size]="13" class="animate-spin motion-reduce:animate-none"></svg>
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
          <div class="flex items-center mt-3 mx-4 pb-2 border-b border-neutral-200 dark:border-neutral-700">
            <div class="flex flex-col items-center flex-1 gap-px">
              <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{{ stats.followers }}</span>
              <span class="text-[10px] text-neutral-500 dark:text-neutral-400">Followers</span>
            </div>
            <div class="flex flex-col items-center flex-1 gap-px">
              <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{{ stats.following }}</span>
              <span class="text-[10px] text-neutral-500 dark:text-neutral-400">Following</span>
            </div>
            <div class="flex flex-col items-center flex-1 gap-px">
              <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{{ stats.moments }}</span>
              <span class="text-[10px] text-neutral-500 dark:text-neutral-400">Moments</span>
            </div>
            <div class="flex flex-col items-center flex-1 gap-px">
              <span class="text-sm font-bold text-neutral-900 dark:text-neutral-100">{{ stats.likes }}</span>
              <span class="text-[10px] text-neutral-500 dark:text-neutral-400">Likes</span>
            </div>
          </div>
        }
      </div>

      <div class="pt-3 px-4 pb-4 flex flex-col gap-3">
        @if (isLoading()) {
          <div class="flex flex-col gap-2">
            <div class="flex gap-2">
              <div class="h-[22px] w-16 rounded-full bg-linear-to-r from-neutral-200 via-neutral-100 to-neutral-200
                          dark:from-neutral-700 dark:via-neutral-600 dark:to-neutral-700
                          [background-size:200%_100%] animate-[shimmer_1.4s_infinite] motion-reduce:animate-none"></div>
              <div class="h-[22px] w-25 rounded-full bg-linear-to-r from-neutral-200 via-neutral-100 to-neutral-200
                          dark:from-neutral-700 dark:via-neutral-600 dark:to-neutral-700
                          [background-size:200%_100%] animate-[shimmer_1.4s_infinite] motion-reduce:animate-none"></div>
            </div>
            <div class="flex gap-2">
              <div class="h-[22px] w-16 rounded-full bg-linear-to-r from-neutral-200 via-neutral-100 to-neutral-200
                          dark:from-neutral-700 dark:via-neutral-600 dark:to-neutral-700
                          [background-size:200%_100%] animate-[shimmer_1.4s_infinite] motion-reduce:animate-none"></div>
              <div class="h-[22px] w-16 rounded-full bg-linear-to-r from-neutral-200 via-neutral-100 to-neutral-200
                          dark:from-neutral-700 dark:via-neutral-600 dark:to-neutral-700
                          [background-size:200%_100%] animate-[shimmer_1.4s_infinite] motion-reduce:animate-none"></div>
            </div>
          </div>
        } @else {
          @if (hasLocationMeta() || nativeLang() || learnLangs().length) {
            <div class="flex flex-col gap-2">
              @if (hasLocationMeta()) {
                <div class="flex items-center gap-2 animate-[itemIn_0.2s_ease-out_backwards] motion-reduce:animate-none">
                  <div class="flex items-center justify-center w-[26px] h-[26px] rounded-md bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div class="flex flex-wrap items-center gap-[5px] text-xs">
                    @if (nationality()) {
                      <app-country-flag [code]="nationality()" />
                    }
                    @if (location(); as loc) {
                      <span class="text-neutral-900 dark:text-neutral-100">{{ loc }}</span>
                    }
                    @if (age(); as a) {
                      <span class="text-neutral-500 dark:text-neutral-400 text-[10px]">{{ a }} yrs old</span>
                    }
                    @if (regDays() != null) {
                      <span class="text-neutral-500 dark:text-neutral-400 text-[10px]">Member for {{ regDays() }}d</span>
                    }
                  </div>
                </div>
              }

              @if (nativeLang() || learnLangs().length) {
                <div class="flex items-center gap-2 animate-[itemIn_0.2s_ease-out_backwards] motion-reduce:animate-none">
                  <div class="flex items-center justify-center w-[26px] h-[26px] rounded-md bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </div>
                  <div class="flex flex-wrap items-center gap-[5px] text-xs">
                    @if (nativeLang(); as lang) {
                      <app-language-tag [langId]="lang" />
                    }
                    @if (learnLangs().length) {
                      <span class="text-neutral-500 dark:text-neutral-400 text-[10px]">also learning</span>
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
            <div class="flex flex-wrap gap-1 animate-[itemIn_0.2s_ease-out_0.05s_backwards] motion-reduce:animate-none">
              @for (chip of tagChips(); track $index) {
                <span class="inline-flex items-center text-[11px] py-0.5 px-2 rounded-full
                             bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300
                             border border-neutral-200 dark:border-neutral-600">{{ chip }}</span>
              }
            </div>
          }

          @if (giftLevel() || pointsSummary()) {
            <div class="flex items-center gap-2">
              <div class="flex items-center justify-center w-[26px] h-[26px] rounded-md shrink-0
                          bg-amber-50 text-amber-600 dark:bg-amber-800/50 dark:text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div class="flex flex-wrap items-center gap-[5px] text-xs">
                @if (giftLevel(); as level) {
                  <span class="{{ CHIP_BASE }} bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">Gift {{ level }}</span>
                }
                @if (pointsSummary(); as pts) {
                  <span class="text-neutral-500 dark:text-neutral-400 text-[10px]">{{ pts }} points</span>
                }
              </div>
            </div>
          }

          @if (remarkName() || profileUrl()) {
            <div class="flex items-center gap-2 pt-1 animate-[itemIn_0.2s_ease-out_0.1s_backwards] motion-reduce:animate-none">
              @if (remarkName(); as remark) {
                <span class="text-xs text-neutral-500 dark:text-neutral-400 italic">&#64;{{ remark }}</span>
              }
              @if (profileUrl(); as url) {
                <a
                  class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-300 no-underline font-medium
                         hover:text-blue-700 hover:underline dark:hover:text-blue-200"
                  [href]="url"
                  target="_blank"
                  rel="noopener"
                >
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
            <div class="flex items-center justify-center py-4">
              <p class="text-xs text-neutral-500 dark:text-neutral-400 m-0 italic">No details yet</p>
            </div>
          }
        }
      </div>
    </app-modal>
  `,
  /** Remaining irreducible CSS: the two bespoke entrance keyframes (no Tailwind
   *  built-in matches these specific slide/scale-in shapes) — kept local rather
   *  than relying on another component's identically-named `@keyframes itemIn`
   *  happening to be in the same bundle. `--_modal-radius` is ModalComponent's
   *  own consumer-override hook (a literal value here, not a design token). */
  styles: [
    `
      :host {
        --_modal-radius: 0.75rem;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes itemIn {
        from { opacity: 0; transform: translateY(4px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
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
  private readonly activeCallStore = inject(ActiveCallStore);

  protected readonly CHIP_BASE = CHIP_BASE;

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

    const room = this.data.roomContext;
    if (this.data.isFollowing == null && room) {
      void this.userInfoService
        .fetchRoomFollowStatus(this.data.userId, room.cname, room.busiType)
        .then((result) => {
          if (!result) return;
          this._isFollowing.set(result.isFollowing);
          this._isMutual.set(result.isMutual);
        });
    }
  }

  /** The viewer's own current room cname (or null if they're not in any room).
   *  Drives the banner's "you're in this room" state — the only true
   *  check is cname equality, regardless of role/host/guest.
   *  Primary source is the ActiveCallStore snapshot (eagerly set on room
   *  enter, both visible and invisible), with the /user/status fetch as
   *  a fallback. The snapshot is the only signal that works for invisible
   *  joins — there's no capture of an invisible user in /user/status
   *  responses, so that endpoint can't be relied on alone. */
  readonly viewerCname = computed(() => {
    const snap = this.activeCallStore.cname();
    if (snap) return snap;
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
    this.onlineStatus() === 'Online'
      ? `${CHIP_BASE} bg-emerald-50 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300`
      : `${CHIP_BASE} bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300`,
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
  // UserInfoService's main fetch) has no follow/mutual field in its `relation`
  // payload — verified against jilalibff's UserInfoResponse.RelationInfo, which
  // only carries counts (followers, following, likes, ...). Two ways this modal
  // still learns the real initial state: callers that already know it (the profile
  // page's Followers/Following tabs, which fetch `is_mutual` per row) pass it in via
  // `data.isFollowing`; callers with a room context but no pre-known value (room
  // roster, managers modal) let the constructor fetch it via
  // `UserInfoService.fetchRoomFollowStatus` (`GET /api/users/{id}/profile`, decoded
  // from bin/cc2018 server-side — the one upstream call that does expose this per
  // arbitrary user). Anywhere else it's genuinely unknown and starts `null`. Either
  // way, the toggle response's `data.status` (1 = now following, 0 = not) becomes
  // the definitive state for the rest of this modal's lifetime once the user
  // actually taps the button.

  private readonly _isFollowing = signal<boolean | null>(this.data.isFollowing ?? null);
  private readonly _isMutual = signal<boolean>(this.data.isMutual ?? false);
  private readonly _isTogglingFollow = signal(false);

  readonly isFollowing = this._isFollowing.asReadonly();
  readonly isMutual = this._isMutual.asReadonly();
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

  /** The Message button is the primary CTA — always filled. This button toggles
   *  to a transparent "Following" state when active, so its full class string is
   *  computed per-state rather than layered with conditional utilities — two
   *  Tailwind classes for the same CSS property (e.g. `bg-blue-500` vs
   *  `bg-transparent`) don't reliably override each other via DOM class order,
   *  only via generated-stylesheet order, so each state needs its own complete
   *  string. */
  protected readonly followBtnClass = computed(() => {
    const base =
      'inline-flex items-center gap-[5px] py-1.5 px-3.5 rounded-full border-[1.5px] text-xs font-semibold ' +
      'cursor-pointer transition-[background-color,opacity,border-color] duration-150 ' +
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ' +
      'disabled:opacity-60 disabled:cursor-not-allowed';
    return this.isFollowing()
      ? `${base} bg-transparent border-blue-500 text-blue-600 not-disabled:hover:bg-blue-50`
      : `${base} bg-blue-500 border-blue-500 text-white not-disabled:hover:bg-blue-600 not-disabled:hover:border-blue-600`;
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
        const nowFollowing = result.data?.status === 1;
        this._isFollowing.set(nowFollowing);
        if (!nowFollowing) this._isMutual.set(false);
      } else {
        this.toast.error(result.message || 'Could not update follow status. Please try again.');
      }
    } catch (err) {
      this.toast.error(httpErrorMessage(err, 'Could not update follow status. Please try again.'));
    } finally {
      this._isTogglingFollow.set(false);
    }
  }

  /**
   * Open a 1:1 conversation with the viewed user. Closes the modal first so
   * the messages page is the only view in focus on arrival, then routes to
   * `/messages?userId=<id>`. The messages page's `userId` input (bound from
   * the query param via `withComponentInputBinding()`) drives a `select(userId)`
   * call, which creates-or-activates the conversation row.
   *
   * Self-message guard: the follow button is hidden when viewing your own
   * profile (see `canFollow()`), but a defensive check is here in case the
   * Send button is reached via another path. We also bail if the viewer's
   * session is missing (logged-out case).
   */
  sendMessage(): void {
    const me = this.authStore.user();
    if (me == null) return;
    if (me.userId === this.data.userId) {
      this.toast.info("You can't message yourself.");
      this.ref.close();
      return;
    }
    this.ref.close();
    void this.router.navigate(['/messages'], {
      queryParams: { userId: this.data.userId },
    });
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
