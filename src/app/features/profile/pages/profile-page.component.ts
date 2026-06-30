import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { ProfileStore, ProfileTab } from '../store/profile.store';
import { AuthStore } from '@core/auth/auth.store';
import { ProfileApi } from '../data-access/profile-api';
import { VisitorListComponent } from '../ui/visitor-list/visitor-list.component';
import { StatsTabComponent } from '../ui/stats-tab/stats-tab.component';
import { EditProfileSheetComponent } from '../ui/edit-profile-sheet/edit-profile-sheet.component';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { getCountryByCode } from '@shared/data/countries';

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VisitorListComponent, StatsTabComponent, AvatarComponent, ButtonComponent, LanguageTagComponent],
  template: `
    @if (store.loading()) {
      <div class="page-loading">
        <div class="sk-header">
          <div class="sk-avatar-ring"></div>
          <div class="sk-identity">
            <div class="sk-name-bar"></div>
            <div class="sk-meta-row"></div>
            <div class="sk-lang-row"></div>
          </div>
        </div>
        <div class="sk-stats-row">
          @for (i of [1,2,3,4]; track i) { <div class="sk-stat-block"></div> }
        </div>
        <div class="sk-tabs">
          @for (i of [1,2,3,4]; track i) { <div class="sk-tab"></div> }
        </div>
      </div>
    } @else if (store.error()) {
      <div class="page-error">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>{{ store.error() }}</p>
        <app-button variant="primary" size="sm" (click)="store.load()">Try again</app-button>
      </div>
    } @else {
      @let tab = store.activeTab();
      @let prof = store.profile();
      @let profUser = prof?.data?.user;
      @let vipType = profUser?.vipType ?? 0;
      @let vip = toVip(vipType);
      @let nat = (prof?.data?.user?.nationality ?? '').toUpperCase();
      @let country = getCountryByCodeFn(nat);
      @let nativeLang = store.langs()?.find(l => l.isTemp === 0)?.lang;
      @let learnLangs = store.langs()?.filter(l => l.isTemp === 1) ?? [];
      @let sex = prof?.data?.user?.sex ?? 1;
      @let isOwn = store.isOwnProfile();
      @let since = fmtMemberSince(store.statsSvc.stats()?.registeredTs);

      <div class="profile-page">

        <!-- Header -->
        <div class="profile-header">
          <div class="avatar-col">
            <div class="avatar-ring" [class]="'ring-' + vip.ringClass">
              <app-avatar
                [src]="isOwn ? (auth.user()?.headUrl ?? profUser?.headUrl ?? '') : (profUser?.headUrl ?? '')"
                [alt]="isOwn ? (auth.user()?.nickname ?? profUser?.nickName ?? 'User') : (profUser?.nickName ?? 'User')"
                size="xxl"
                [crownType]="vip.crown"
                [ringColor]="vip.ringColor"
              />
            </div>
            @if (prof?.data?.isRealAuth) {
              <div class="badge badge--verified">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Verified
              </div>
            }
          </div>

          <div class="identity-col">
            <div class="name-row">
              <span class="nickname">
                {{ isOwn ? (auth.user()?.nickname ?? profUser?.nickName ?? 'User') : (profUser?.nickName ?? 'User') }}
              </span>
              @if (vip.label) {
                <span class="vip-chip" [class]="'vip-tier-' + vip.tier">{{ vip.label }}</span>
              }
              @if (sex === 1) {
                <svg class="sex-icon" style="color: var(--color-social-500)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="10" cy="14" r="5"/><path d="M19 5l-5.4 5.4M19 5h-5M19 5v5"/>
                </svg>
              } @else if (sex === 0) {
                <svg class="sex-icon" style="color: var(--color-berry-500)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="9" r="5"/><path d="M12 14v7M9 18h6"/>
                </svg>
              }
            </div>

            <div class="meta-row">
              @if (country?.flag) {
                <span>{{ country?.flag }}</span>
                <span class="meta-country">{{ country?.name }}</span>
              }
              @if (since) {
                <span class="meta-sep">·</span>
                <span class="meta-since">Member {{ since }}</span>
              }
            </div>

            @if (nativeLang) {
              <div class="langs-stack">
                <div class="lang-row">
                  <app-language-tag [langId]="nativeLang" />
                  <span class="lang-role">Native</span>
                </div>
                @for (lang of learnLangs; track lang.lang) {
                  <div class="lang-row">
                    <app-language-tag [langId]="lang.lang" />
                    <div class="level-bar">
                      @for (s of [1,2,3,4,5]; track s) {
                        <div class="level-pip" [class.filled]="s <= (lang.isExpiredVipSelfSetLang === 1 ? 0 : 1)"></div>
                      }
                    </div>
                    <span class="lang-level-lbl">Learning</span>
                  </div>
                }
              </div>
            }

            <div class="action-row">
              @if (isOwn) {
                <app-button variant="secondary" size="sm" (click)="openEditSheet()">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L9 17.5"/>
                  </svg>
                  Edit
                </app-button>
              } @else {
                <app-button [variant]="isFollowing() ? 'soft-primary' : 'primary'" size="sm"
                  (click)="toggleFollow()" [loading]="followLoading()">
                  @if (isFollowing()) {
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Following
                  } @else {
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Follow
                  }
                </app-button>
                <app-button variant="secondary" size="sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Message
                </app-button>
              }
            </div>
          </div>
        </div>

        <!-- Social strip -->
        <div class="social-strip">
          <button class="social-chip" [class.active]="tab === 'followers'" (click)="store.setTab('followers')">
            <strong>{{ prof?.data?.increment?.newFollowerCount ?? '—' }}</strong>
            <span>Followers</span>
          </button>
          <div class="social-div"></div>
          <button class="social-chip" [class.active]="tab === 'following'" (click)="store.setTab('following')">
            <strong>{{ store.followingSvc.totalCount() || store.followingSvc.following()?.length ?? '—' }}</strong>
            <span>Following</span>
          </button>
          <div class="social-div"></div>
          <button class="social-chip" (click)="store.setTab('visitors')">
            <strong>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </strong>
            <span>Visitors</span>
          </button>
          <div class="social-div"></div>
          <button class="social-chip" (click)="store.setTab('stats')">
            <strong>{{ store.unreadLikes() > 0 ? store.unreadLikes() : '—' }}</strong>
            <span>Likes</span>
          </button>
        </div>

        <!-- Tabs -->
        <div class="tab-bar" role="tablist">
          @for (t of tabs; track t.id) {
            <button role="tab" class="tab-btn" [class.tab-active]="tab === t.id"
              [attr.aria-selected]="tab === t.id" (click)="store.setTab(t.id)">
              {{ t.label }}
            </button>
          }
        </div>

        <!-- Content -->
        @switch (tab) {
          @case ('followers') {
            <div class="user-grid">
              @for (user of store.followersSvc.followers() ?? []; track user.userId) {
                <div class="user-card" (click)="navigateTo(user.userId)">
                  <app-avatar
                    [src]="user.headUrl ?? ''"
                    [alt]="user.nickName ?? 'User'"
                    size="lg"
                    [ringColor]="user.isMutual ? 'var(--color-accent-400)' : null"
                    [crownType]="(user.vipType ?? 0) > 0 ? 2 : null"
                  />
                  <span class="user-name">{{ user.nickName ?? 'User' }}</span>
                  @if (user.isMutual) { <span class="mutual-dot"></span> }
                </div>
              } @empty {
                <div class="tab-empty">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                  </svg>
                  <p>No followers yet</p>
                </div>
              }
              @if (store.followersSvc.nextCursor()) {
                <button class="load-more-btn" (click)="store.followersSvc.loadMore()">Load more</button>
              }
            </div>
          }
          @case ('following') {
            <div class="user-grid">
              @for (user of store.followingSvc.following() ?? []; track user.userId) {
                <div class="user-card" (click)="navigateTo(user.userId)">
                  <app-avatar
                    [src]="user.headUrl ?? ''"
                    [alt]="user.nickName ?? 'User'"
                    size="lg"
                    [crownType]="(user.vipType ?? 0) > 0 ? 2 : null"
                  />
                  <span class="user-name">{{ user.nickName ?? 'User' }}</span>
                </div>
              } @empty {
                <div class="tab-empty">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="23" y2="12"/>
                    <line x1="23" y1="8" x2="19" y2="12"/>
                  </svg>
                  <p>Not following anyone</p>
                </div>
              }
              @if (store.followingSvc.nextCursor()) {
                <button class="load-more-btn" (click)="store.followingSvc.loadMore()">Load more</button>
              }
            </div>
          }
          @case ('visitors') { <app-visitor-list /> }
          @case ('stats') { <app-stats-tab /> }
          @default never;
        }
      </div>
    }
  `,
  styles: [`
    .profile-page { max-width: 480px; margin: 0 auto; min-height: 100dvh; display: flex; flex-direction: column; }

    /* Skeleton */
    .page-loading { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-4); }
    .sk-header { display: flex; gap: var(--space-4); align-items: flex-start; }
    .sk-avatar-ring { width: 88px; height: 88px; border-radius: var(--radius-full); background: var(--color-neutral-200); flex-shrink: 0; }
    .sk-identity { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); padding-top: var(--space-2); }
    .sk-name-bar { height: 20px; width: 60%; border-radius: var(--radius-md); background: var(--color-neutral-200); }
    .sk-meta-row { height: 14px; width: 50%; border-radius: var(--radius-sm); background: var(--color-neutral-100); }
    .sk-lang-row { height: 14px; width: 75%; border-radius: var(--radius-sm); background: var(--color-neutral-100); }
    .sk-stats-row { display: flex; gap: var(--space-3); }
    .sk-stat-block { flex: 1; height: 52px; border-radius: var(--radius-xl); background: var(--color-neutral-100); }
    .sk-tabs { display: flex; gap: var(--space-2); }
    .sk-tab { flex: 1; height: 36px; border-radius: var(--radius-md); background: var(--color-neutral-100); }

    /* Error */
    .page-error { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-12) var(--space-4); text-align: center; color: var(--color-text-muted); }
    .page-error p { margin: 0; font-size: var(--text-sm); }

    /* Header */
    .profile-header { display: flex; gap: var(--space-4); padding: var(--space-5) var(--space-4) var(--space-4); }
    .avatar-col { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); flex-shrink: 0; }
    .avatar-ring { position: relative; padding: 3px; border-radius: var(--radius-full); }
    .ring-vip { background: linear-gradient(135deg, var(--color-gold-300), var(--color-gold-500)); }
    .ring-vip-plus { background: linear-gradient(135deg, var(--color-primary-400), var(--color-accent-400)); }
    .badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: var(--radius-full); font-size: 9px; font-weight: var(--font-semibold); }
    .badge--verified { background: var(--color-accent-100); color: var(--color-accent-700); border: 1px solid var(--color-accent-200); }

    .identity-col { flex: 1; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
    .name-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .nickname { font-size: var(--text-xl); font-weight: var(--font-bold); color: var(--color-text); line-height: var(--leading-tight); }
    .vip-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 10px; font-weight: var(--font-bold); letter-spacing: 0.04em; }
    .vip-tier-1, .vip-tier-2 { background: linear-gradient(135deg, var(--color-gold-300), var(--color-gold-500)); color: white; }
    .vip-tier-3, .vip-tier-100 { background: linear-gradient(135deg, var(--color-primary-400), var(--color-accent-400)); color: white; }
    .sex-icon { display: flex; align-items: center; }

    .meta-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
    .meta-country { font-size: var(--text-xs); color: var(--color-text-secondary); }
    .meta-sep { color: var(--color-neutral-300); font-size: var(--text-xs); }
    .meta-since { font-size: var(--text-xs); color: var(--color-text-muted); }

    .langs-stack { display: flex; flex-direction: column; gap: 3px; }
    .lang-row { display: flex; align-items: center; gap: 6px; }
    .lang-role { font-size: 9px; font-weight: var(--font-semibold); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
    .level-bar { display: flex; gap: 2px; }
    .level-pip { width: 14px; height: 5px; border-radius: 2px; background: var(--color-neutral-200); }
    .level-pip.filled { background: var(--color-accent-400); }
    .lang-level-lbl { font-size: 9px; color: var(--color-text-muted); }

    .action-row { display: flex; gap: var(--space-2); margin-top: var(--space-1); flex-wrap: wrap; }

    /* Social strip */
    .social-strip { display: flex; margin: 0 var(--space-4); background: var(--color-card); border-radius: var(--radius-xl); border: 1px solid var(--color-border); overflow: hidden; }
    .social-chip { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: var(--space-3) var(--space-2); border: none; background: transparent; cursor: pointer; transition: background 0.15s; font-family: inherit; }
    .social-chip:hover { background: var(--color-neutral-50); }
    .social-chip.active { background: var(--color-primary-50); }
    .social-chip strong { font-size: var(--text-base); font-weight: var(--font-bold); color: var(--color-text); display: flex; align-items: center; gap: 3px; }
    .social-chip span { font-size: 10px; color: var(--color-text-muted); font-weight: var(--font-medium); }
    .social-div { width: 1px; background: var(--color-border); margin: var(--space-2) 0; }

    /* Tabs */
    .tab-bar { display: flex; border-bottom: 1px solid var(--color-border); margin: var(--space-4) var(--space-4) 0; }
    .tab-btn { flex: 1; padding: var(--space-3) var(--space-2); border: none; background: transparent; font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text-muted); cursor: pointer; position: relative; transition: color 0.15s; font-family: inherit; }
    .tab-btn:hover { color: var(--color-text); }
    .tab-active { color: var(--color-primary-500); font-weight: var(--font-semibold); }
    .tab-active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: var(--color-primary-500); border-radius: 2px 2px 0 0; }

    /* Content */
    .tab-loading, .tab-empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); color: var(--color-text-muted); font-size: var(--text-sm); padding: var(--space-10) 0; text-align: center; }
    .tab-empty svg { opacity: 0.3; }
    .tab-empty p { margin: 0; }

    /* User grid */
    .user-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4) var(--space-2); padding: var(--space-4); }
    .user-card { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; animation: fade-in-up 0.2s ease; }
    .user-name { font-size: 11px; font-weight: var(--font-medium); color: var(--color-text); text-align: center; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
    .mutual-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent-400); }
    .load-more-btn { grid-column: 1 / -1; padding: var(--space-3); border: 1px dashed var(--color-border); border-radius: var(--radius-lg); background: transparent; color: var(--color-text-muted); font-size: var(--text-sm); cursor: pointer; transition: background 0.15s; font-family: inherit; }
    .load-more-btn:hover { background: var(--color-neutral-50); }
  `],
})
export class ProfilePageComponent implements OnInit {
  protected readonly store = inject(ProfileStore);
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(ProfileApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(Dialog);
  private readonly _followLoading = signal(false);

  readonly tabs: { id: ProfileTab; label: string }[] = [
    { id: 'followers', label: 'Followers' },
    { id: 'following', label: 'Following' },
    { id: 'visitors', label: 'Visitors' },
    { id: 'stats', label: 'Stats' },
  ];

  readonly isFollowing = this.store.isFollowing.asReadonly();
  readonly followLoading = this._followLoading.asReadonly();

  readonly fmtMemberSince = (ts: number | undefined) =>
    ts ? new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
  readonly getCountryByCodeFn = getCountryByCode;

  readonly toVip: (vt: number) => { label: string; tier: 0|1|3|100; ringClass: 'vip'|'vip-plus'|'none'; ringColor: string|null; crown: 1|2|null } =
    (vt: number) => {
      if (vt >= 100) return { label: 'VIP Founder', tier: 100, ringClass: 'vip-plus' as const, ringColor: 'var(--color-primary-400)', crown: 1 as const };
      if (vt >= 3)   return { label: 'VIP+',        tier: 3,   ringClass: 'vip-plus' as const, ringColor: 'var(--color-primary-400)', crown: 1 as const };
      if (vt > 0)   return { label: 'VIP',          tier: 1,   ringClass: 'vip' as const,      ringColor: 'var(--color-gold-400)',    crown: 2 as const };
      return             { label: '',                tier: 0,   ringClass: 'none' as const,    ringColor: null,                        crown: null };
    };

  ngOnInit(): void {
    const uid = this.route.snapshot.paramMap.get('userId');
    if (uid) this.store.setTargetUid(Number(uid));
    void this.store.load();
  }

  openEditSheet(): void {
    this.dialog.open(EditProfileSheetComponent, { panelClass: 'bottom-sheet' });
  }

  async toggleFollow(): Promise<void> {
    const uid = this.store.profile()?.data?.user?.userId;
    if (!uid) return;
    const nick = this.store.profile()?.data?.user?.nickName ?? '';
    const was = this.store.isFollowing();
    this.store.isFollowing.set(!was);
    this._followLoading.set(true);
    try {
      const r = await firstValueFrom(this.api.follow(uid, nick));
      if (r.status !== 0) this.store.isFollowing.set(was);
    } catch { this.store.isFollowing.set(was); }
    finally { this._followLoading.set(false); }
  }

  navigateTo(userId: number): void {
    void this.router.navigate(['/profile', userId]);
  }
}
