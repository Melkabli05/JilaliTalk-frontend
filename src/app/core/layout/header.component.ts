import { Component, ChangeDetectionStrategy, DestroyRef, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Observable, catchError, filter, finalize, of, switchMap, tap } from 'rxjs';
import { LucidePlus, LucideLogIn, LucideBell } from '@lucide/angular';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { ThemeToggleComponent } from '@shared/ui/theme/theme-toggle.component';
import { UserMenuComponent } from '@shared/ui/user-menu/user-menu.component';
import { CreateRoomModalComponent, CreateRoomModalData, CreateRoomResult } from '@shared/ui/create-room-modal/create-room-modal.component';
import { NotificationPanelComponent } from '@shared/ui/notification-panel/notification-panel.component';
import { NotificationStore } from '@store/notification.store';
import { Category } from '@shared/data/categories';
import { CreateRoomService } from '@core/services/create-room.service';
import { ToastService } from '@core/services/toast.service';
import { AuthStore } from '@core/auth/auth.store';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    RouterLink,
    ButtonComponent,
    ThemeToggleComponent,
    UserMenuComponent,
    LucidePlus,
    LucideLogIn,
    LucideBell,
    NotificationPanelComponent,
  ],
  template: `
    <header
      role="banner"
      id="main-content"
      tabindex="-1"
      [class.immersive]="immersive()"
      class="app-header fixed inset-x-0 top-0 flex items-center justify-between
             px-4 pb-0 lg:px-6
             bg-white/80 dark:bg-neutral-900/80
             backdrop-blur-xl backdrop-saturate-150
             border-b border-neutral-200/60 dark:border-neutral-800/60
             lg:left-[var(--sidebar-width)] rtl:lg:left-auto rtl:lg:right-[var(--sidebar-width)]"
    >
      <div class="flex items-center gap-2">
        <svg aria-hidden="true" class="shrink-0 drop-shadow-sm" width="26" height="26" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="headerLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#2563eb"/>
              <stop offset="100%" stop-color="#4f46e5"/>
            </linearGradient>
          </defs>
          <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" fill="url(#headerLogoGrad)"/>
          <path d="M16 8l-8 4v8l8 4 8-4v-8l-8-4z" fill="white" fill-opacity="0.25"/>
          <path d="M12 16l4-4 4 4-4 4-4-4z" fill="white"/>
        </svg>
        <span class="hidden min-[381px]:inline text-base font-bold tracking-tight bg-linear-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">JilaliTalk</span>
      </div>

      <div class="flex items-center gap-2">
        <div
          role="status"
          [attr.aria-label]="'Connection status: ' + (isConnected() ? 'Online' : 'Offline')"
          class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full
                 bg-neutral-100 dark:bg-neutral-800
                 border border-neutral-200 dark:border-neutral-700"
        >
          <span
            class="size-2 rounded-full transition-colors"
            [class]="isConnected()
              ? 'bg-emerald-500 dark:bg-emerald-400 ring-2 ring-emerald-500/25 dark:ring-emerald-400/25'
              : 'bg-neutral-400 dark:bg-neutral-600'"
          ></span>
          <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">{{ isConnected() ? 'Online' : 'Offline' }}</span>
        </div>

        <button
          type="button"
          class="notification-btn relative inline-flex items-center justify-center min-h-11 min-w-11
                 rounded-lg bg-transparent border-0 cursor-pointer
                 text-neutral-600 dark:text-neutral-500
                 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
                 transition-colors duration-150
                 hover:bg-blue-500/8 hover:text-blue-600
                 dark:hover:bg-blue-400/10 dark:hover:text-blue-300
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          [class.has-unread]="notificationStore.unreadCount() > 0"
          [attr.aria-label]="'Notifications' + (notificationStore.unreadCount() > 0 ? ', ' + notificationStore.unreadCount() + ' unread' : '')"
          (click)="notificationStore.toggle()"
        >
          <svg aria-hidden="true" lucideBell [size]="18"></svg>
          @if (notificationStore.unreadCount() > 0) {
            <span class="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-[5px] rounded-full
                         bg-red-500 dark:bg-red-400 text-white text-[10px] font-bold
                         flex items-center justify-center leading-none shadow-sm">{{ notificationStore.unreadCount() > 9 ? '9+' : notificationStore.unreadCount() }}</span>
          }
        </button>

        @if (authStore.user(); as user) {
          <app-user-menu [user]="user" (logout)="logout()" />
        } @else {
          <app-button
            variant="soft-primary"
            size="sm"
            aria-label="Login to JilaliTalk"
            (click)="login()"
          >
            <svg aria-hidden="true" lucideLogIn [size]="14"></svg>
            <span class="hidden sm:inline">Login</span>
          </app-button>
        }

        <app-button
          variant="soft-primary"
          size="sm"
          aria-label="Create new voice room"
          [loading]="creatingRoom()"
          (click)="openCreateRoomModal()"
        >
          <svg aria-hidden="true" lucidePlus [size]="15" strokeWidth="2.5"></svg>
          <span>Create</span>
        </app-button>
        <app-theme-toggle />
      </div>
    </header>
    <app-notification-panel />
  `,
  /**
   * Only structural/functional properties remain here — nothing that Tailwind v4 utilities +
   * the default color palette can express (color, spacing, radius, shadow, typography are all
   * in the template above). What's left and why:
   *   - height/padding-top from --app-header-height + safe-area-inset-top: a coordinated
   *     contract with the shell's --shell-inset-top (see app.ts), not a branding value.
   *   - z-index from --z-shell-header: shared stacking-order coordination with sidenav/
   *     mobile-nav/modals, not a color/style choice.
   *   - .immersive display:none: state-driven, class-bound from the [immersive] input.
   */
  styles: [`
    .app-header {
      z-index: var(--z-shell-header);
      height: calc(var(--app-header-height) + env(safe-area-inset-top, 0px));
      padding-top: env(safe-area-inset-top, 0px);
      padding-left: max(1rem, env(safe-area-inset-left, 0px));
      padding-right: max(1rem, env(safe-area-inset-right, 0px));
    }
    .app-header.immersive { display: none; }
  `]
})
export class HeaderComponent {
  /** Bound by the shell: true when the route is immersive AND the viewport is mobile.
   *  The global header is hidden in that mode so the room gets the full viewport top edge. */
  readonly immersive = input(false);

  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly createRoomService = inject(CreateRoomService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  readonly notificationStore = inject(NotificationStore);

  readonly isConnected = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly creatingRoom = signal(false);

  private readonly categoriesResource = rxResource<Category[], void>({
    stream: () => this.createRoomService.fetchCategories() as Observable<Category[]>,
    defaultValue: [],
  });

  constructor() {
    if (typeof window !== 'undefined') {
      const online = () => this.isConnected.set(true);
      const offline = () => this.isConnected.set(false);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('online', online);
        window.removeEventListener('offline', offline);
      });
      window.addEventListener('online', online);
      window.addEventListener('offline', offline);
    }
  }

  openCreateRoomModal(): void {
    // Hard gate at the action level, not just the UI level — authGuard on /room/* protects
    // the destination, but the create modal itself was previously reachable by clicking Create
    // regardless of session state. Route to /login first so the user comes back here after.
    if (!this.authStore.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url || '/rooms' } });
      return;
    }
    this.creatingRoom.set(true);
    this.createRoomService
      .fetchActiveChannel()
      .pipe(
        catchError(() => of(null)),
        finalize(() => {}),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((active) => {
        if (active?.cname) {
          this.router.navigate(['/room', active.cname, 2]);
          this.creatingRoom.set(false);
          return;
        }
        this.creatingRoom.set(false);
        this.doOpenModal();
      });
  }

  login(): void {
    // Navigate to /login (a real page, not a modal dialog) so the user can bookmark/share the
    // sign-in URL, and so deep links like /login?returnUrl=/messages work uniformly. The page
    // itself bounces them back here after a successful login.
    void this.router.navigate(['/login']);
  }

  logout(): void {
    this.authStore.logout();
    this.toast.success('Logged out.');
    this.authService.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
  }

  private doOpenModal(): void {
    const ref = this.dialog.open<CreateRoomResult, CreateRoomModalData>(CreateRoomModalComponent, {
      backdropClass: 'app-modal-backdrop',
      ariaLabelledBy: 'create-room-title',
      data: { categories: this.categoriesResource.value() ?? [] },
    });

    ref.closed.pipe(
      filter((result): result is CreateRoomResult => Boolean(result)),
      tap(() => this.creatingRoom.set(true)),
      switchMap((result) =>
        this.createRoomService.createVoiceRoom(result).pipe(
          tap({ next: (res) => this.router.navigate(['/room', res.cname, 2], { queryParams: { fresh: 'true' } }) }),
          finalize(() => this.creatingRoom.set(false)),
          catchError(() => {
            this.toast.error('Failed to create room. Please try again.');
            return of(null);
          }),
        ),
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }
}
