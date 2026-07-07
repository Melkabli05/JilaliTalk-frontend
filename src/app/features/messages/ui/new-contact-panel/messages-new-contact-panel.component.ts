import {
  ChangeDetectionStrategy,
  Component,
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
import { LucideClose, LucideUserPlus } from '@lucide/angular';
import { ProfileApi } from '@features/profile/data-access/profile-api';
import { UserListItemComponent } from '@shared/ui/user-list/user-list-item';
import type { SocialUser, VisitorUser, UserInfo } from '@features/profile/models/profile.model';

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
  imports: [LucideClose, LucideUserPlus, UserListItemComponent],
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
  protected readonly more = signal({ following: false, followers: false, visitors: false });
  protected readonly cursor = signal<{ following?: string; visitors?: number }>({});

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

  protected readonly currentMore = computed<boolean>(() => this.more()[this.tab()]);

  protected isMutual(u: SocialUser | VisitorUser): boolean {
    return (u as SocialUser).isMutual === true;
  }

  // ── View children ─────────────────────────────────────────────
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  private readonly api = inject(ProfileApi);

  constructor() {
    // First fetch when the panel first opens; clear by-id error when it closes.
    effect(() => {
      if (this.open()) {
        this.refetchTab(this.tab());
      } else {
        this.idError.set(null);
      }
    });

    // Tab-switch refetch. The first effect already re-fetches the *current* tab on
    // open, so this one only acts when the tab changes to a *different* value — the
    // `lastTab` guard prevents a double load on the very first open.
    let lastTab: TabId | null = null;
    effect(() => {
      if (!this.open()) { lastTab = null; return; }
      const t = this.tab();
      if (t === lastTab) return;
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
    this.api.userInfo(userId).subscribe({
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
      if (tab === 'following') { this.following.set([]); this.cursor.update(c => ({ ...c, following: undefined })); }
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

  private fetchFollowing(append: boolean): void {
    const pageIndex = append ? (this.cursor().following ?? '1') : '1';
    this.loading.update(l => ({ ...l, following: true }));
    this.api.followers(pageIndex, 50).subscribe({
      next: (page) => {
        this.followers.update(curr => append ? [...curr, ...page.list] : [...page.list]);
        this.cursor.update(c => ({ ...c, following: page.pageIndex ?? c.following }));
        this.more.update(m => ({ ...m, followers: page.more }));
        this.loading.update(l => ({ ...l, followers: false }));
      },
      error: () => {
        this.loading.update(l => ({ ...l, followers: false }));
        this.error.update(e => ({ ...e, followers: 'Could not load followers.' }));
      },
    });
  }

  private fetchFollowers(append: boolean): void {
    this.loading.update(l => ({ ...l, following: true }));
    this.api.following(50).subscribe({
      next: (page) => {
        this.following.update(curr => append ? [...curr, ...page.list] : [...page.list]);
        this.more.update(m => ({ ...m, following: page.more }));
        this.loading.update(l => ({ ...l, following: false }));
      },
      error: () => {
        this.loading.update(l => ({ ...l, following: false }));
        this.error.update(e => ({ ...e, following: 'Could not load following.' }));
      },
    });
  }

  private fetchVisitors(append: boolean): void {
    const idx = append ? (this.cursor().visitors ?? 0) : 0;
    this.loading.update(l => ({ ...l, visitors: true }));
    this.api.visitors(idx).subscribe({
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