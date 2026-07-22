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
    <div class="relative">
      <button
        type="button"
        class="flex items-center gap-2 min-h-11 pr-2 pl-1.5 rounded-full bg-transparent border border-transparent
               cursor-pointer text-neutral-900 dark:text-neutral-100 max-w-[180px]
               [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
               transition-colors duration-150
               hover:bg-neutral-100 hover:border-neutral-200
               dark:hover:bg-neutral-800 dark:hover:border-neutral-700
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        [class]="open() ? 'bg-neutral-100 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700' : ''"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'Account menu for ' + displayName()"
        (click)="toggle($event)"
      >
        <app-avatar [src]="user().headUrl ?? ''" [alt]="displayName()" size="sm" />
        <span class="hidden sm:inline-block text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-24">{{ displayName() }}</span>
        <svg
          aria-hidden="true"
          lucideChevronDown
          [size]="14"
          class="shrink-0 text-neutral-500 transition-transform duration-150"
          [class.rotate-180]="open()"
        ></svg>
      </button>

      @if (open()) {
        <div
          class="dropdown absolute top-[calc(100%+0.5rem)] right-0 z-[var(--z-overlay)] w-60
                 max-w-[calc(100vw-2rem)] rounded-lg overflow-hidden
                 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700
                 shadow-lg
                 animate-[user-menu-in_0.15s_ease] motion-reduce:animate-none
                 rtl:right-auto rtl:left-0"
          role="menu"
          [attr.aria-label]="'Account: ' + displayName()"
        >
          <div class="flex items-center gap-3 p-3">
            <app-avatar [src]="user().headUrl ?? ''" [alt]="displayName()" size="md" />
            <div class="flex flex-col min-w-0 gap-0.5">
              <span class="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis" [title]="displayName()">{{ displayName() }}</span>
              <span class="text-xs text-neutral-500 whitespace-nowrap overflow-hidden text-ellipsis" [title]="user().email">{{ user().email }}</span>
            </div>
          </div>
          <div class="h-px bg-neutral-200 dark:bg-neutral-700" role="separator"></div>
          <a
            role="menuitem"
            routerLink="/profile"
            class="flex items-center gap-2 w-full py-2 px-3 bg-transparent border-0 text-neutral-900 dark:text-neutral-100
                   text-sm text-left no-underline cursor-pointer transition-colors duration-100
                   hover:bg-neutral-100 dark:hover:bg-neutral-800
                   focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
            (click)="close()"
          >
            <svg aria-hidden="true" lucideUser [size]="16"></svg>
            <span>View profile</span>
          </a>
          <button
            type="button"
            role="menuitem"
            class="flex items-center gap-2 w-full py-2 px-3 bg-transparent border-0 text-sm text-left cursor-pointer
                   transition-colors duration-100
                   text-red-600 dark:text-red-400
                   hover:bg-red-500/10
                   focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
            (click)="onLogout()"
          >
            <svg aria-hidden="true" lucideLogOut [size]="16"></svg>
            <span>Logout</span>
          </button>
        </div>
      }
    </div>
  `,
  /** Remaining structural CSS: z-index uses --z-overlay (shared stacking-order coordination).
   *  The dropdown-entrance keyframe is genuine motion design, no Tailwind built-in equivalent. */
  styles: [`
    @keyframes user-menu-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
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
