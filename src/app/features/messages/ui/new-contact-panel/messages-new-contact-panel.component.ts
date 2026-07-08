import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideX } from '@lucide/angular';
import { ProfileApi } from '@features/profile/data-access/profile-api';
import { UserListItemComponent } from '@shared/ui/user-list/user-list-item';
import type { SocialUser, VisitorUser } from '@features/profile/models/profile.model';
import type { UserInfo } from '@core/services/user-info.service';

export type TabId = 'following' | 'followers' | 'visitors' | 'byId';

type LoadingMap = {
  following: boolean;
  followers: boolean;
  visitors: boolean;
  byId: boolean;
};
type ErrorMap = {
  following: string | null;
  followers: string | null;
  visitors: string | null;
  byId: string | null;
};

@Component({
  selector: 'app-messages-new-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX, UserListItemComponent],
  templateUrl: './messages-new-contact-panel.component.html',
  styleUrl: './messages-new-contact-panel.component.scss',
})
export class MessageNewContactPanelComponent {
  // ── Inputs/outputs ─────────────────────────────────────────────
  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly picked = output<number>();

  // ── Tab + per-tab state ───────────────────────────────────────
  protected readonly tab = signal<TabId>('following');
  protected readonly following = signal<readonly SocialUser[]>([]);
  protected readonly followers = signal<readonly SocialUser[]>([]);
  protected readonly visitors = signal<readonly VisitorUser[]>([]);
  protected readonly byIdResult = signal<UserInfo | null>(null);

  protected readonly loading = signal<LoadingMap>({
    following: false,
    followers: false,
    visitors: false,
    byId: false,
  });
  protected readonly more = signal<{ following: boolean; followers: boolean; visitors: boolean }>({
    following: false,
    followers: false,
    visitors: false,
  });
  protected readonly cursor = signal<{ visitors?: number | undefined }>({});

  protected readonly error = signal<ErrorMap>({
    following: null,
    followers: null,
    visitors: null,
    byId: null,
  });

  // ── By-ID input ───────────────────────────────────────────────
  protected readonly idQuery = signal('');
  protected readonly idError = signal<string | null>(null);

  // ── Static tab labels ─────────────────────────────────────────
  protected readonly tabs = [
    { id: 'following' as const, label: 'Following' },
    { id: 'followers' as const, label: 'Followers' },
    { id: 'visitors'  as const, label: 'Visitors'  },
    { id: 'byId'      as const, label: 'By ID'     },
  ];

  protected readonly currentList = computed<readonly (SocialUser | VisitorUser)[]>(() => {
    switch (this.tab()) {
      case 'following': return this.following();
      case 'followers': return this.followers();
      case 'visitors':  return this.visitors();
      case 'byId':      return [];
    }
  });

  protected readonly currentMore = computed<boolean>(() => {
    // Load-more is only relevant for the list tabs (following / followers / visitors);
    // the by-id tab has no pagination. Narrowing here keeps `more`'s type accurate
    // (no phantom byId flag) while letting the computed signal stay typed as boolean.
    const t = this.tab();
    if (t === 'byId') return false;
    return this.more()[t];
  });

  protected isMutual(u: SocialUser | VisitorUser): boolean {
    return (u as SocialUser).isMutual === true;
  }

  protected userIdOf(u: SocialUser | VisitorUser): number {
    return (u as SocialUser).userId ?? (u as VisitorUser).userid;
  }

  protected nameOf(u: SocialUser | VisitorUser): string {
    return (u as SocialUser).nickName ?? (u as VisitorUser).nickname ?? 'User';
  }

  protected variantFor(tab: TabId): 'following' | 'followers' | 'visitors' {
    return tab === 'byId' ? 'followers' : tab;
  }

  protected vipTypeOf(u: SocialUser | VisitorUser): number | null {
    return (u as SocialUser).vipType ?? null;
  }

  // ── View children ─────────────────────────────────────────────
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  private readonly destroyRef = inject(DestroyRef);

  private readonly api = inject(ProfileApi);

  constructor() {
    // Single effect that handles all transitions: panel opening (any first time after
    // close), panel closing (reset state), and tab switching. Two separate effects here
    // would double-fire on every first-open (one for `open()`, one for `tab()` starting
    // from the initial null `lastTab`). The `lastTab`/`lastOpen` guards collapse that
    // to exactly one refetch per meaningful transition.
    let lastTab: TabId | null = null;
    let lastOpen = false;

    effect(() => {
      const isOpen = this.open();
      const t = this.tab();

      // Panel closing — reset cursor so reopen re-fetches fresh.
      if (!isOpen) {
        lastTab = null;
        lastOpen = false;
        this.idError.set(null);
        return;
      }

      // First open since last close, OR a tab switch — fetch.
      if (lastOpen && t === lastTab) return;
      lastOpen = true;
      lastTab = t;
      this.refetchTab(t);
    });
  }

  // ── Public template handlers ──────────────────────────────────
  protected onTabClick(tab: TabId): void { this.tab.set(tab); }
  protected onClose(): void { this.closed.emit(); }
  protected onPick(userId: number): void { this.picked.emit(userId); }

  protected onIdQuery(value: string): void {
    this.idQuery.set(value);
    if (this.idError()) this.idError.set(null);
  }

  protected onLookUpId(): void {
    const raw = this.idQuery().trim();
    if (!raw) return;
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
      this.idError.set('Enter a numeric user id.');
      return;
    }
    this.loading.update(l => ({ ...l, byId: true }));
    this.byIdResult.set(null);
    this.api.userInfo(userId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (info) => {
        this.byIdResult.set(info);
        this.idError.set(null);
        this.loading.update(l => ({ ...l, byId: false }));
      },
      error: () => {
        this.byIdResult.set(null);
        this.idError.set('User not found.');
        this.loading.update(l => ({ ...l, byId: false }));
      },
    });
  }

  protected retry(tab: TabId): void {
    this.error.update(e => ({ ...e, [tab]: null }));
    this.refetchTab(tab);
  }

  protected loadMore(): void {
    const t = this.tab();
    this.refetchTab(t, /*append=*/ true);
  }

  // ── Internals ────────────────────────────────────────────────
  private refetchTab(tab: TabId, append = false): void {
    // Reset state on a fresh (non-append) refetch — loadMore keeps existing list.
    if (!append) {
      if (tab === 'following') { this.following.set([]); }
      if (tab === 'followers') { this.followers.set([]); }
      if (tab === 'visitors')  { this.visitors.set([]);  this.cursor.update(c => ({ ...c, visitors: undefined })); }
      if (tab === 'byId')      { this.byIdResult.set(null); }
      this.more.update(m => ({ ...m, [tab]: false }));
      this.error.update(e => ({ ...e, [tab]: null }));
    }

    if (tab === 'following') this.fetchFollowing(append);
    if (tab === 'followers') this.fetchFollowers(append);
    if (tab === 'visitors')  this.fetchVisitors(append);
    // byId has nothing to fetch on tab change.
  }

  private fetchFollowing(_append: boolean): void {
    // Tied to the "Following" tab — call api.following and write to the following signal.
    this.loading.update(l => ({ ...l, following: true }));
    this.api.following(50).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.following.update(curr => curr.length ? [...curr, ...page.list] : [...page.list]);
        // The Following API does not support pagination — always force `more=false` so
        // the Load-more control doesn't render an extra click that would just refetch
        // the same first 50 and append them (which silently duplicates the list).
        this.more.update(m => ({ ...m, following: false }));
        this.loading.update(l => ({ ...l, following: false }));
      },
      error: () => {
        this.loading.update(l => ({ ...l, following: false }));
        this.error.update(e => ({ ...e, following: 'Could not load following.' }));
      },
    });
  }

  private fetchFollowers(append: boolean): void {
    // Tied to the "Followers" tab — call api.followers and write to the followers signal.
    this.loading.update(l => ({ ...l, followers: true }));
    this.api.followers('1', 50).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.followers.update(curr => append ? [...curr, ...page.list] : [...page.list]);
        // The Followers API does not support pagination either — same rationale as the
        // Following branch above. Server-side pagination is the real fix; for now we
        // simply don't pretend the API has a "next page".
        this.more.update(m => ({ ...m, followers: false }));
        this.loading.update(l => ({ ...l, followers: false }));
      },
      error: () => {
        this.loading.update(l => ({ ...l, followers: false }));
        this.error.update(e => ({ ...e, followers: 'Could not load followers.' }));
      },
    });
  }

  private fetchVisitors(append: boolean): void {
    const idx = append ? (this.cursor().visitors ?? 0) : 0;
    this.loading.update(l => ({ ...l, visitors: true }));
    this.api.visitors(idx).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.visitors.update(curr => append ? [...curr, ...page.list] : [...page.list]);
        this.cursor.update(c => ({ ...c, visitors: idx + 1 }));
        this.more.update(m => ({ ...m, visitors: page.more }));
        this.loading.update(l => ({ ...l, visitors: false }));
      },
      error: () => {
        this.loading.update(l => ({ ...l, visitors: false }));
        this.error.update(e => ({ ...e, visitors: 'Could not load visitors.' }));
      },
    });
  }

  // ── Host-level listeners ─────────────────────────────────────
  @HostListener('keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(ev: MouseEvent): void {
    if (!this.open()) return;
    const panel = this.panel()?.nativeElement;
    const target = ev.target as Node | null;
    if (!panel || !target) return;
    // Click inside the panel: do nothing.
    if (panel.contains(target)) return;
    // Otherwise, close.
    this.closed.emit();
  }
}