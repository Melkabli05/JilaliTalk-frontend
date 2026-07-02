import { Component, ChangeDetectionStrategy, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { Observable, catchError, filter, finalize, of, switchMap, tap } from 'rxjs';
import { LucidePlus, LucideCoins, LucideLogIn, LucideLogOut, LucideBell } from '@lucide/angular';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { ThemeToggleComponent } from '@shared/ui/theme/theme-toggle.component';
import { AuthDialogComponent } from '@shared/ui/auth-dialog/auth-dialog.component';
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
    ButtonComponent,
    ThemeToggleComponent,
    LucidePlus,
    LucideCoins,
    LucideLogIn,
    LucideLogOut,
    LucideBell,
    NotificationPanelComponent,
  ],
  template: `
    <header role="banner" class="app-header" id="main-content" tabindex="-1">
      <div class="brand">
        <svg aria-hidden="true" class="brand-icon" width="26" height="26" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="headerLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="var(--color-primary-500)"/>
              <stop offset="100%" stop-color="var(--color-accent-500)"/>
            </linearGradient>
          </defs>
          <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" fill="url(#headerLogoGrad)"/>
          <path d="M16 8l-8 4v8l8 4 8-4v-8l-8-4z" fill="white" fill-opacity="0.25"/>
          <path d="M12 16l4-4 4 4-4 4-4-4z" fill="white"/>
        </svg>
        <span class="brand-name">JilaliTalk</span>
      </div>

      <div class="actions">

        <div class="status-pill" role="status" [attr.aria-label]="'Connection status: ' + (isConnected() ? 'Online' : 'Offline')">
          <span class="status-dot" [class.online]="isConnected()"></span>
          <span class="status-text">{{ isConnected() ? 'Online' : 'Offline' }}</span>
        </div>

        <button
          type="button"
          class="notification-btn"
          [class.has-unread]="notificationStore.unreadCount() > 0"
          [attr.aria-label]="'Notifications' + (notificationStore.unreadCount() > 0 ? ', ' + notificationStore.unreadCount() + ' unread' : '')"
          (click)="notificationStore.toggle()"
        >
          <svg aria-hidden="true" lucideBell [size]="18"></svg>
          @if (notificationStore.unreadCount() > 0) {
            <span class="notification-badge">{{ notificationStore.unreadCount() > 9 ? '9+' : notificationStore.unreadCount() }}</span>
          }
        </button>

        <div class="coins-badge" [attr.aria-label]="userCoins() + ' coins available'" tabindex="0" (click)="showCoinDetails()">
          <svg aria-hidden="true" lucideCoins [size]="14"></svg>
          <span>{{ userCoins() }}</span>
        </div>

        @if (isAuthenticated()) {
          <app-button 
            variant="soft-neutral" 
            size="sm" 
            class="auth-btn"
            aria-label="Logout of JilaliTalk" 
            (click)="logout()"
          >
            <svg aria-hidden="true" lucideLogOut [size]="15"></svg>
            <span class="btn-text">Logout</span>
          </app-button>
        } @else {
          <app-button 
            variant="soft-primary" 
            size="sm" 
            class="auth-btn" 
            aria-label="Login to JilaliTalk" 
            (click)="login()"
          >
            <svg aria-hidden="true" lucideLogIn [size]="14"></svg>
            <span class="btn-text">Login</span>
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
  styles: [`
    .app-header {
      position: sticky;
      top: 0;
      z-index: var(--z-shell-header);
      height: var(--app-header-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-4);
      background: color-mix(in srgb, var(--color-card) 88%, transparent);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid var(--color-border);
    }
    @media (min-width: 1024px) {
      .app-header { padding: 0 var(--space-6); }
    }
    /* Brand */
    .brand {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .brand-icon {
      flex-shrink: 0;
      filter: drop-shadow(var(--shadow-sm));
    }
    .brand-name {
      font-size: var(--text-base);
      font-weight: var(--font-bold);
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, var(--color-primary-600), var(--color-accent-600));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    @media (max-width: 380px) {
      .brand-name { display: none; }
    }
    /* Actions */
    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    /* Status pill */
    .status-pill {
      display: none;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-100);
      border: 1px solid var(--color-border);
    }
    @media (min-width: 640px) {
      .status-pill { display: flex; }
    }
    :host-context(.dark) .status-pill {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }
    .status-dot {
      width: var(--space-2);
      height: var(--space-2);
      border-radius: 50%;
      background: var(--color-neutral-400);
      transition: background 0.2s ease;
    }
    .status-dot.online {
      background: var(--color-accent-500);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-500) 25%, transparent);
    }
    :host-context(.dark) .status-dot {
      background: var(--color-neutral-600);
    }
    :host-context(.dark) .status-dot.online {
      background: var(--color-accent-400);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-400) 25%, transparent);
    }
    .status-text {
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .status-text { color: var(--color-neutral-400); }
    /* Coins Badge */
    .coins-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 30px;
      padding: 0 10px;
      border-radius: var(--radius-full);
      background: linear-gradient(135deg, var(--color-gold-100), var(--color-gold-50));
      color: var(--color-gold-700);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      border: 1px solid color-mix(in srgb, var(--color-gold-300) 40%, transparent);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .coins-badge:hover {
      background: linear-gradient(135deg, var(--color-gold-200), var(--color-gold-100));
      transform: translateY(-1px);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--color-gold-400) 25%, transparent);
    }
    .coins-badge:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    :host-context(.dark) .coins-badge {
      background: linear-gradient(135deg, var(--color-gold-900), var(--color-gold-800));
      color: var(--color-gold-300);
      border-color: color-mix(in srgb, var(--color-gold-600) 40%, transparent);
    }
    :host-context(.dark) .coins-badge:hover {
      background: linear-gradient(135deg, var(--color-gold-800), var(--color-gold-700));
      transform: translateY(-1px);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--color-gold-500) 30%, transparent);
    }

    /* Notification Bell Button */
    .notification-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-lg);
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .notification-btn:hover {
      background: color-mix(in srgb, var(--color-primary-500) 8%, transparent);
      color: var(--color-primary-600);
    }

    .notification-btn:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }

    .notification-btn.has-unread {
      color: var(--color-primary-500);
    }

    .notification-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: var(--radius-full);
      background: var(--color-warm-500);
      color: var(--color-on-color);
      font-size: 10px;
      font-weight: var(--font-bold);
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    }

    :host-context(.dark) .notification-btn {
      color: var(--color-neutral-500);
    }

    :host-context(.dark) .notification-btn:hover {
      background: color-mix(in srgb, var(--color-primary-400) 10%, transparent);
      color: var(--color-primary-300);
    }

    :host-context(.dark) .notification-btn.has-unread {
      color: var(--color-primary-400);
    }

    :host-context(.dark) .notification-badge {
      background: var(--color-warm-400);
    }

    /* Responsive Auth Buttons */
    .auth-btn .btn-text {
      display: none;
    }
    @media (min-width: 640px) {
      .auth-btn .btn-text {
        display: inline;
      }
    }
  `]
})
export class HeaderComponent {
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly createRoomService = inject(CreateRoomService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  readonly notificationStore = inject(NotificationStore);

  readonly isConnected = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly creatingRoom = signal(false);
  readonly userCoins = signal(120);

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
    this.dialog.open(AuthDialogComponent, {
      backdropClass: 'app-modal-backdrop',
      ariaLabelledBy: 'auth-dialog-title',
    });
  }

  logout(): void {
    this.authStore.logout();
    this.toast.success('Logged out.');
    this.authService.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => {} });
  }

  showCoinDetails(): void {
    this.toast.info(`You currently have ${this.userCoins()} coins.`);
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
          tap({ next: (res) => this.router.navigate(['/room', res.cname, 2]) }),
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