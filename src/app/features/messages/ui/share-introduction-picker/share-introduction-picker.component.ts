import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { A11yModule } from '@angular/cdk/a11y';
import { of } from 'rxjs';
import { LucideSearch, LucideUserPlus, LucideX } from '@lucide/angular';
import { ProfileApi } from '@features/profile/data-access/profile-api';
import { UserListItemComponent } from '@shared/ui/user-list/user-list-item';
import type { SocialListPage, SocialUser } from '@features/profile/models/profile.model';
import type { UserInfo } from '@core/services/user-info.service';
import type { IntroductionPayload } from '@core/realtime/ht-protocol/packet-framer.util';

const EMPTY_PAGE: SocialListPage = { pageIndex: null, more: false, count: 0, list: [] };

type TabId = 'following' | 'followers' | 'byId';

type EmptyLabel = 'following' | 'followers';

@Component({
  selector: 'app-share-introduction-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, UserListItemComponent, LucideSearch, LucideUserPlus, LucideX],
  template: `
    <div class="backdrop" (click)="onBackdropClick($event)">
      <div
        class="sheet"
        #sheet
        role="dialog"
        aria-modal="true"
        aria-label="Share a profile"
        tabindex="-1"
        [cdkTrapFocus]="true"
        cdkTrapFocusAutoCapture
        (click)="$event.stopPropagation()"
      >
        <header class="sheet-header">
          <div class="sheet-title">
            <svg aria-hidden="true" lucideUserPlus [size]="16"></svg>
            <span>Share a profile</span>
          </div>
          <button type="button" class="sheet-close" (click)="closed.emit()" aria-label="Close">
            <svg aria-hidden="true" lucideX [size]="16"></svg>
          </button>
        </header>

        <nav class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="tab"
            [class.tab--active]="tab() === 'following'"
            [attr.aria-selected]="tab() === 'following'"
            (click)="tab.set('following')"
          >Following</button>
          <button
            type="button"
            role="tab"
            class="tab"
            [class.tab--active]="tab() === 'followers'"
            [attr.aria-selected]="tab() === 'followers'"
            (click)="tab.set('followers')"
          >Followers</button>
          <button
            type="button"
            role="tab"
            class="tab"
            [class.tab--active]="tab() === 'byId'"
            [attr.aria-selected]="tab() === 'byId'"
            (click)="tab.set('byId')"
          >By ID</button>
        </nav>

        @switch (tab()) {
          @case ('following') {
            <div class="list" role="tabpanel">
              @if (followingLoading()) {
                <p class="status">Loading…</p>
              } @else if (followingError()) {
                <p class="status status--error">Could not load following.</p>
              } @else {
                @let users = followingUsers();
                @if (users.length === 0) {
                  <p class="status">{{ emptyCopy('following') }}</p>
                } @else {
                  @for (u of users; track u.userId) {
                    <app-user-list-item
                      [userId]="u.userId"
                      [name]="u.nickName ?? 'User'"
                      [headUrl]="u.headUrl"
                      [nationality]="u.nationality"
                      [vipType]="u.vipType"
                      [isMutual]="u.isMutual"
                      variant="following"
                      (userClick)="onFollowingPicked(u)"
                    />
                  }
                }
              }
            </div>
          }
          @case ('followers') {
            <div class="list" role="tabpanel">
              @if (followersLoading()) {
                <p class="status">Loading…</p>
              } @else if (followersError()) {
                <p class="status status--error">Could not load followers.</p>
              } @else {
                @let users = followersUsers();
                @if (users.length === 0) {
                  <p class="status">{{ emptyCopy('followers') }}</p>
                } @else {
                  @for (u of users; track u.userId) {
                    <app-user-list-item
                      [userId]="u.userId"
                      [name]="u.nickName ?? 'User'"
                      [headUrl]="u.headUrl"
                      [nationality]="u.nationality"
                      [vipType]="u.vipType"
                      [isMutual]="u.isMutual"
                      variant="following"
                      (userClick)="onFollowingPicked(u)"
                    />
                  }
                }
              }
            </div>
          }
          @case ('byId') {
            <form class="byid-form" (submit)="$event.preventDefault(); submitById()">
              <svg aria-hidden="true" lucideSearch [size]="14" class="byid-icon"></svg>
              <input
                #byidInput
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                class="byid-field"
                placeholder="Enter user ID"
                [value]="byIdDraft()"
                (input)="byIdDraft.set($any($event.target).value)"
                aria-label="User ID"
              />
              <button type="submit" class="byid-submit" [disabled]="!byIdValid()">Find</button>
            </form>
            <div class="list" role="tabpanel">
              @if (byIdState() === 'searching') {
                <p class="status">Searching…</p>
              } @else if (byIdState() === 'error') {
                <p class="status status--error">User not found.</p>
              } @else if (byIdResult(); as info) {
                <button type="button" class="byid-result" (click)="onByIdPicked(info)">
                  <app-user-list-item
                    [userId]="info.userId"
                    [name]="info.nickname ?? info.username ?? 'User'"
                    [headUrl]="info.details?.base?.headUrl ?? null"
                    [nationality]="info.nationality"
                    variant="following"
                  />
                </button>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: contents; }
      .backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--z-overlay);
        background: color-mix(in srgb, var(--color-black) 40%, transparent);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: fadeIn 0.15s ease-out;
      }
      .sheet {
        width: min(560px, 100%);
        max-height: 80vh;
        background: var(--color-card);
        border-top-left-radius: var(--radius-2xl);
        border-top-right-radius: var(--radius-2xl);
        border-top: 1px solid var(--color-border);
        box-shadow: var(--shadow-elevation-3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: slideUp 0.18s ease-out;
      }
      @media (max-width: 767.98px) {
        .backdrop {
          padding-bottom: env(safe-area-inset-bottom);
        }
      }
      @media (min-width: 768px) {
        .backdrop { align-items: center; padding: var(--space-4); }
        .sheet {
          max-height: 70vh;
          border-radius: var(--radius-2xl);
          border: 1px solid var(--color-border);
        }
      }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .backdrop, .sheet { animation: none; }
      }

      .sheet-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }
      .sheet-title {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text);
      }
      .sheet-close {
        width: var(--icon-btn-size);
        height: var(--icon-btn-size);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-sm);
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--color-text-muted);
      }
      .sheet-close:hover { background: var(--color-neutral-100); color: var(--color-text); }
      :host-context(.dark) .sheet-close:hover { background: var(--color-neutral-800); }
      .sheet-close:focus-visible {
        outline: var(--focus-ring);
        outline-offset: 2px;
      }

      .tabs {
        display: flex;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-4);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }
      .tab {
        padding: 6px var(--space-3);
        border-radius: var(--radius-full);
        background: transparent;
        border: 0;
        cursor: pointer;
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        font-weight: var(--font-medium);
      }
      .tab:hover { background: var(--color-neutral-100); color: var(--color-text); }
      :host-context(.dark) .tab:hover { background: var(--color-neutral-800); }
      .tab--active {
        background: var(--color-primary-50);
        color: var(--color-primary-700);
      }
      :host-context(.dark) .tab--active {
        background: color-mix(in srgb, var(--color-primary-900) 50%, transparent);
        color: var(--color-primary-200);
      }

      .list {
        overflow-y: auto;
        padding: var(--space-2);
        flex: 1;
        min-height: 0;
      }
      .status {
        margin: var(--space-4);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        text-align: center;
      }
      .status--error { color: var(--color-danger); }

      .byid-form {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: var(--space-2) var(--space-3);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        background: var(--color-card);
      }
      .byid-form:focus-within {
        border-color: var(--color-primary-300);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 14%, transparent);
      }
      .byid-icon { color: var(--color-text-muted); flex-shrink: 0; }
      .byid-field {
        flex: 1;
        border: 0;
        background: transparent;
        outline: 0;
        font: inherit;
        font-size: var(--text-sm);
        color: var(--color-text);
        min-width: 0;
      }
      .byid-submit {
        padding: 4px var(--space-3);
        border-radius: var(--radius-full);
        background: var(--color-primary-500);
        color: var(--color-on-color);
        border: 0;
        font: inherit;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        cursor: pointer;
      }
      .byid-submit:hover:not(:disabled) { background: var(--color-primary-600); }
      .byid-submit:disabled {
        background: var(--color-neutral-200);
        color: var(--color-text-muted);
        cursor: not-allowed;
      }
      :host-context(.dark) .byid-submit:disabled { background: var(--color-neutral-700); }

      .byid-result {
        width: 100%;
        text-align: left;
        background: transparent;
        border: 0;
        padding: 0;
        font: inherit;
        color: inherit;
        cursor: pointer;
      }
      .byid-result:focus-visible {
        outline: var(--focus-ring);
        outline-offset: -2px;
      }
    `,
  ],
})
export class ShareIntroductionPickerComponent {
  readonly picked = output<IntroductionPayload>();
  readonly closed = output<void>();

  private readonly api = inject(ProfileApi);

  protected readonly tab = signal<TabId>('following');
  protected readonly byIdDraft = signal('');
  protected readonly submittedById = signal<number | null>(null);

  protected readonly byIdValid = computed(() => /^\d+$/.test(this.byIdDraft().trim()));

  private readonly followingRes = rxResource<SocialListPage, boolean | undefined>({
    params: () => (this.tab() === 'following' ? true : undefined),
    stream: ({ params }) => (params === undefined ? of(EMPTY_PAGE) : this.api.following(50)),
    defaultValue: EMPTY_PAGE,
  });

  private readonly followersRes = rxResource<SocialListPage, boolean | undefined>({
    params: () => (this.tab() === 'followers' ? true : undefined),
    stream: ({ params }) => (params === undefined ? of(EMPTY_PAGE) : this.api.followers('1', 50)),
    defaultValue: EMPTY_PAGE,
  });

  private readonly byIdRes = rxResource<UserInfo | null, number | null>({
    params: () => this.submittedById(),
    stream: ({ params }) => (params == null ? of(null) : this.api.userInfo(params)),
    defaultValue: null,
  });

  protected readonly followingUsers = computed<readonly SocialUser[]>(
    () => this.followingRes.value().list,
  );
  protected readonly followingLoading = computed(() => this.followingRes.isLoading());
  protected readonly followingError = computed(() =>
    this.followingRes.error() ? 'Could not load following.' : null,
  );

  protected readonly followersUsers = computed<readonly SocialUser[]>(
    () => this.followersRes.value().list,
  );
  protected readonly followersLoading = computed(() => this.followersRes.isLoading());
  protected readonly followersError = computed(() =>
    this.followersRes.error() ? 'Could not load followers.' : null,
  );

  protected readonly byIdResult = computed(() => this.byIdRes.value());
  protected readonly byIdState = computed<'idle' | 'searching' | 'error' | 'found'>(() => {
    const id = this.submittedById();
    if (id == null) return 'idle';
    if (this.byIdRes.isLoading()) return 'searching';
    if (this.byIdRes.error()) return 'error';
    if (this.byIdRes.value()) return 'found';
    return 'idle';
  });

  protected emptyCopy(which: EmptyLabel): string {
    return which === 'following' ? "You're not following anyone yet." : 'No followers yet.';
  }

  protected onFollowingPicked(u: SocialUser): void {
    this.picked.emit({
      userId: u.userId,
      nickname: u.nickName ?? 'User',
      headUrl: u.headUrl ?? null,
      sex: u.sex != null ? String(u.sex) : null,
      nationality: u.nationality ?? null,
      age: null,
      bio: null,
    });
  }

  protected onByIdPicked(info: UserInfo): void {
    const base = info.details?.base;
    this.picked.emit({
      userId: info.userId,
      nickname: info.nickname ?? info.username ?? 'User',
      headUrl: base?.headUrl ?? null,
      sex: info.sex ?? (base?.sex != null ? String(base.sex) : null),
      age: info.age ?? base?.age ?? null,
      nationality: info.nationality ?? base?.nationality ?? null,
      bio: base?.signature ?? null,
    });
  }

  protected submitById(): void {
    const id = Number(this.byIdDraft().trim());
    if (!Number.isFinite(id) || id <= 0) return;
    this.submittedById.set(id);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void { this.closed.emit(); }
}
