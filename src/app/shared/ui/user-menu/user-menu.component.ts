import { Component, ChangeDetectionStrategy, ElementRef, inject, input, output, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronDown, LucideUser, LucideLogOut } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import type { AuthUser } from '@core/auth/auth.store';

/**
 * The logged-in identity trigger in the app header: avatar + nickname, opening a small
 * dropdown with "view profile" and "logout". Replaces a bare Logout button — once login
 * actually verifies a real HelloTalk account (see com.jilali.auth), the header should say
 * *whose* account is signed in, not just that *someone* is.
 *
 * Deliberately not built on CDK Overlay/Menu (unused elsewhere in this codebase) — matches
 * the existing lightweight pattern (a signal-driven open flag, a document-click/Escape
 * listener to close) already used by NotificationPanelComponent.
 */
@Component({
  selector: 'app-user-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AvatarComponent, LucideChevronDown, LucideUser, LucideLogOut],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    <div class="user-menu">
      <button
        type="button"
        class="trigger"
        [class.open]="open()"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'Account menu for ' + displayName()"
        (click)="toggle($event)"
      >
        <app-avatar [src]="user().headUrl ?? ''" [alt]="displayName()" size="sm" />
        <span class="nickname">{{ displayName() }}</span>
        <svg aria-hidden="true" lucideChevronDown [size]="14" class="chevron" [class.rotated]="open()"></svg>
      </button>

      @if (open()) {
        <div class="dropdown" role="menu" [attr.aria-label]="'Account: ' + displayName()">
          <div class="dropdown-header">
            <app-avatar [src]="user().headUrl ?? ''" [alt]="displayName()" size="md" />
            <div class="identity">
              <span class="identity-name" [title]="displayName()">{{ displayName() }}</span>
              <span class="identity-email" [title]="user().email">{{ user().email }}</span>
            </div>
          </div>
          <div class="dropdown-divider" role="separator"></div>
          <a role="menuitem" routerLink="/profile" class="dropdown-item" (click)="close()">
            <svg aria-hidden="true" lucideUser [size]="16"></svg>
            <span>View profile</span>
          </a>
          <button type="button" role="menuitem" class="dropdown-item danger" (click)="onLogout()">
            <svg aria-hidden="true" lucideLogOut [size]="16"></svg>
            <span>Logout</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .user-menu {
      position: relative;
    }
    .trigger {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      height: 36px;
      padding: 0 var(--space-2) 0 6px;
      border-radius: var(--radius-full);
      background: transparent;
      border: 1px solid transparent;
      cursor: pointer;
      color: var(--color-text-primary);
      transition: background-color 0.15s ease, border-color 0.15s ease;
      max-width: 180px;
    }
    .trigger:hover,
    .trigger.open {
      background: var(--color-neutral-100);
      border-color: var(--color-border);
    }
    .trigger:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .dark .trigger:hover,
    .dark .trigger.open {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }
    .nickname {
      display: none;
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 96px;
    }
    @media (min-width: 640px) {
      .nickname { display: inline-block; }
    }
    .chevron {
      flex-shrink: 0;
      color: var(--color-text-muted);
      transition: transform 0.15s ease;
    }
    .chevron.rotated {
      transform: rotate(180deg);
    }

    .dropdown {
      position: absolute;
      top: calc(100% + var(--space-2));
      right: 0;
      z-index: var(--z-overlay);
      width: 240px;
      max-width: calc(100vw - var(--space-4) * 2);
      border-radius: var(--radius-lg);
      background: var(--color-card);
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-dropdown);
      overflow: hidden;
      animation: user-menu-in 0.15s ease;
    }
    @keyframes user-menu-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .dropdown { animation: none; }
    }

    .dropdown-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
    }
    .identity {
      display: flex;
      flex-direction: column;
      min-width: 0;
      gap: 2px;
    }
    .identity-name {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .identity-email {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dropdown-divider {
      height: 1px;
      background: var(--color-border);
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      padding: var(--space-2) var(--space-3);
      background: transparent;
      border: none;
      color: var(--color-text-primary);
      font-size: var(--text-sm);
      text-align: left;
      text-decoration: none;
      cursor: pointer;
      transition: background-color 0.1s ease;
    }
    .dropdown-item:hover {
      background: var(--color-neutral-100);
    }
    .dropdown-item:focus-visible {
      outline: var(--focus-ring);
      outline-offset: -2px;
    }
    .dropdown-item.danger {
      color: var(--color-error-600);
    }
    .dropdown-item.danger:hover {
      background: color-mix(in srgb, var(--color-error-500) 10%, transparent);
    }
    .dark .dropdown-item:hover {
      background: var(--color-neutral-800);
    }
    .dark .dropdown-item.danger {
      color: var(--color-error-400);
    }
    .dark .dropdown-item.danger:hover {
      background: color-mix(in srgb, var(--color-error-400) 12%, transparent);
    }
  `],
})
export class UserMenuComponent {
  private readonly elementRef = inject(ElementRef);

  readonly user = input.required<AuthUser>();
  readonly logout = output<void>();

  readonly open = signal(false);

  /** Falls back to the email's local part, then a generic label — the backend can return a
   *  null nickname (e.g. if the post-login profile lookup failed), so this never renders blank. */
  readonly displayName = computed(() => {
    const nickname = this.user().nickname?.trim();
    if (nickname) return nickname;
    const email = this.user().email;
    const localPart = email ? email.split('@')[0] : undefined;
    return localPart || 'Account';
  });

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
  }

  onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  onLogout(): void {
    this.close();
    this.logout.emit();
  }
}
