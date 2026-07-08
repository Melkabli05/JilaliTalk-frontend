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

type Row = SocialUser | VisitorUser;

@Component({
  selector: 'app-messages-new-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX, UserListItemComponent],
  templateUrl: './messages-new-contact-panel.component.html',
  styleUrl: './messages-new-contact-panel.component.scss',
})
export class MessageNewContactPanelComponent {
  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  readonly picked = output<number>();

  protected readonly tab = signal<TabId>('following');
  protected readonly following = signal<readonly SocialUser[]>([]);
  protected readonly followers = signal<readonly SocialUser[]>([]);
  protected readonly visitors = signal<readonly VisitorUser[]>([]);
  protected readonly byIdResult = signal<UserInfo | null>(null);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly moreVisitors = signal(false);
  private visitorsCursor = 0;

  protected readonly idQuery = signal('');
  protected readonly idError = signal<string | null>(null);

  protected readonly tabs = [
    { id: 'following' as const, label: 'Following' },
    { id: 'followers' as const, label: 'Followers' },
    { id: 'visitors'  as const, label: 'Visitors'  },
    { id: 'byId'      as const, label: 'By ID'     },
  ];

  protected readonly currentList = computed<readonly Row[]>(() => {
    switch (this.tab()) {
      case 'following': return this.following();
      case 'followers': return this.followers();
      case 'visitors':  return this.visitors();
      case 'byId':      return [];
    }
  });

  protected readonly currentMore = computed(() => this.tab() === 'visitors' && this.moreVisitors());

  protected userIdOf(u: Row): number {
    return (u as SocialUser).userId ?? (u as VisitorUser).userid;
  }
  protected nameOf(u: Row): string {
    return (u as SocialUser).nickName ?? (u as VisitorUser).nickname ?? 'User';
  }
  protected variantFor(): 'following' | 'followers' | 'visitors' {
    const t = this.tab();
    return t === 'byId' ? 'followers' : t;
  }
  protected vipTypeOf(u: Row): number | null {
    return (u as SocialUser).vipType ?? null;
  }
  protected isMutual(u: Row): boolean {
    return (u as SocialUser).isMutual === true;
  }

  protected readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ProfileApi);
  private lastFired: { open: boolean; tab: TabId } | null = null;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const t = this.tab();
      if (!isOpen) { this.lastFired = null; this.idError.set(null); return; }
      const key = { open: true, tab: t };
      if (this.lastFired && this.lastFired.open === key.open && this.lastFired.tab === key.tab) return;
      this.lastFired = key;
      this.refetchTab(t, /*append=*/ false);
    });
  }

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
    this.loading.set(true);
    this.byIdResult.set(null);
    this.api.userInfo(userId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (info) => {
        this.byIdResult.set(info);
        this.idError.set(null);
        this.loading.set(false);
      },
      error: () => {
        this.byIdResult.set(null);
        this.idError.set('User not found.');
        this.loading.set(false);
      },
    });
  }

  protected retry(): void {
    this.error.set(null);
    this.refetchTab(this.tab(), false);
  }

  protected loadMore(): void {
    if (this.tab() === 'visitors') this.refetchTab('visitors', true);
  }

  private refetchTab(tab: TabId, append: boolean): void {
    if (!append) {
      if (tab === 'following') this.following.set([]);
      if (tab === 'followers') this.followers.set([]);
      if (tab === 'visitors')  { this.visitors.set([]); this.visitorsCursor = 0; }
      if (tab === 'byId')      this.byIdResult.set(null);
      this.moreVisitors.set(false);
      this.error.set(null);
    }
    if (tab === 'following') this.fetchFollowing();
    if (tab === 'followers') this.fetchFollowers();
    if (tab === 'visitors')  this.fetchVisitors(append);
  }

  private fetchFollowing(): void {
    this.loading.set(true);
    this.api.following(50).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.following.set(page.list);
        this.moreVisitors.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load following.');
      },
    });
  }

  private fetchFollowers(): void {
    this.loading.set(true);
    this.api.followers('1', 50).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.followers.set(page.list);
        this.moreVisitors.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load followers.');
      },
    });
  }

  private fetchVisitors(append: boolean): void {
    this.loading.set(true);
    this.api.visitors(append ? this.visitorsCursor : 0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.visitors.update(curr => append ? [...curr, ...page.list] : [...page.list]);
          this.visitorsCursor = (append ? this.visitorsCursor : 0) + 1;
          this.moreVisitors.set(page.more);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Could not load visitors.');
        },
      });
  }

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
    if (panel.contains(target)) return;
    this.closed.emit();
  }
}
