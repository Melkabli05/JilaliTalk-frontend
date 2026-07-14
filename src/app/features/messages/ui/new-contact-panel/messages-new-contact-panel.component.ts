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
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { LucideX } from '@lucide/angular';
import { ProfileApi } from '@features/profile/data-access/profile-api';
import { UserListItemComponent } from '@shared/ui/user-list/user-list-item';
import { injectIsMobileViewport } from '@shared/utils';
import type { SocialListPage, SocialUser, VisitorUser } from '@features/profile/models/profile.model';
import type { UserInfo } from '@core/services/user-info.service';

const SHEET_BREAKPOINT_QUERY = '(max-width: 640px)';

export type TabId = 'following' | 'followers' | 'visitors' | 'byId';

type Row = SocialUser | VisitorUser;

const EMPTY_SOCIAL_PAGE: SocialListPage = { pageIndex: null, more: false, count: 0, list: [] };

@Component({
  selector: 'app-messages-new-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX, UserListItemComponent],
  templateUrl: './messages-new-contact-panel.component.html',
  styleUrl: './messages-new-contact-panel.component.scss',
})
export class MessageNewContactPanelComponent {
  readonly open = input<boolean>(false);
  readonly closed = output<void>();
  readonly picked = output<number>();

  protected readonly tab = signal<TabId>('following');
  protected readonly visitors = signal<readonly VisitorUser[]>([]);
  protected readonly moreVisitors = signal(false);
  protected readonly visitorsLoading = signal(false);
  protected readonly visitorsError = signal<string | null>(null);
  private visitorsCursor = 0;

  protected readonly idQuery = signal('');
  protected readonly idFormatError = signal<string | null>(null);
  private readonly submittedId = signal<number | null>(null);

  protected readonly tabs = [
    { id: 'following' as const, label: 'Following' },
    { id: 'followers' as const, label: 'Followers' },
    { id: 'visitors'  as const, label: 'Visitors'  },
    { id: 'byId'      as const, label: 'By ID'     },
  ];

  private readonly api = inject(ProfileApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  protected readonly isMobile = injectIsMobileViewport(SHEET_BREAKPOINT_QUERY);

  private readonly followingRes = rxResource<SocialListPage, boolean | undefined>({
    params: () => (this.open() && this.tab() === 'following' ? true : undefined),
    stream: ({ params }) => (params === undefined ? of(EMPTY_SOCIAL_PAGE) : this.api.following(50)),
    defaultValue: EMPTY_SOCIAL_PAGE,
  });

  private readonly followersRes = rxResource<SocialListPage, boolean | undefined>({
    params: () => (this.open() && this.tab() === 'followers' ? true : undefined),
    stream: ({ params }) => (params === undefined ? of(EMPTY_SOCIAL_PAGE) : this.api.followers('1', 50)),
    defaultValue: EMPTY_SOCIAL_PAGE,
  });

  private readonly byIdRes = rxResource<UserInfo | null, number | undefined>({
    params: () => this.submittedId() ?? undefined,
    stream: ({ params }) => (params === undefined ? of(null) : this.api.userInfo(params)),
    defaultValue: null,
  });

  protected readonly byIdResult = this.byIdRes.value;
  protected readonly idError = computed(
    () => this.idFormatError() ?? (this.byIdRes.error() ? 'User not found.' : null),
  );

  protected readonly currentList = computed<readonly Row[]>(() => {
    switch (this.tab()) {
      case 'following': return this.followingRes.value().list;
      case 'followers': return this.followersRes.value().list;
      case 'visitors':  return this.visitors();
      case 'byId':      return [];
    }
  });

  protected readonly loading = computed(() => {
    switch (this.tab()) {
      case 'following': return this.followingRes.isLoading();
      case 'followers': return this.followersRes.isLoading();
      case 'visitors':  return this.visitorsLoading();
      case 'byId':      return this.byIdRes.isLoading();
    }
  });

  protected readonly error = computed(() => {
    switch (this.tab()) {
      case 'following': return this.followingRes.error() ? 'Could not load following.' : null;
      case 'followers': return this.followersRes.error() ? 'Could not load followers.' : null;
      case 'visitors':  return this.visitorsError();
      case 'byId':      return null;
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

  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open() && this.tab() === 'visitors') this.fetchVisitors(false);
    });

    effect(() => {
      if (this.open()) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        queueMicrotask(() => this.panel()?.nativeElement.focus());
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });

    effect(() => {
      if (!this.isMobile()) return;
      if (this.open()) {
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = '';
        };
      }
      return;
    });
  }

  protected onTabClick(tab: TabId): void { this.tab.set(tab); }
  protected onClose(): void { this.closed.emit(); }
  protected onOverlayClick(): void { this.closed.emit(); }
  protected onPick(userId: number): void { this.picked.emit(userId); }

  protected onIdQuery(value: string): void {
    this.idQuery.set(value);
    this.idFormatError.set(null);
  }

  protected onLookUpId(): void {
    const raw = this.idQuery().trim();
    if (!raw) return;
    const userId = Number(raw);
    if (!Number.isFinite(userId) || userId <= 0) {
      this.idFormatError.set('Enter a numeric user id.');
      return;
    }
    this.idFormatError.set(null);
    if (this.submittedId() === userId) this.byIdRes.reload();
    else this.submittedId.set(userId);
  }

  protected retry(): void {
    switch (this.tab()) {
      case 'following': this.followingRes.reload(); break;
      case 'followers': this.followersRes.reload(); break;
      case 'visitors':  this.fetchVisitors(false); break;
      case 'byId':      break;
    }
  }

  protected loadMore(): void {
    if (this.tab() === 'visitors') this.fetchVisitors(true);
  }

  private fetchVisitors(append: boolean): void {
    this.visitorsLoading.set(true);
    this.visitorsError.set(null);
    if (!append) this.visitorsCursor = 0;
    this.api.visitors(this.visitorsCursor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.visitors.update(curr => append ? [...curr, ...page.list] : [...page.list]);
          this.visitorsCursor += 1;
          this.moreVisitors.set(page.more);
          this.visitorsLoading.set(false);
        },
        error: () => {
          this.visitorsLoading.set(false);
          this.visitorsError.set('Could not load visitors.');
        },
      });
  }

  @HostListener('keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }
}
