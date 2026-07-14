import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Shared chrome for the two fullscreen, chromeless auth routes (/login, /signup — see
 * app.routes.ts's `fullscreen: true` data flag, which strips the global header/sidenav/
 * mobile-nav for these). Both pages need the exact same brand mark and card frame; only the
 * icon, copy, form fields, and footer link differ, so those are content projection slots
 * rather than two copies of the same layout.
 *
 * Deliberately plain: flat card on flat background, the same icon-tint and shadow tokens
 * used for every other card/badge in this app (see managers-modal.ts's `.empty-icon-circle`
 * for the precedent) — no blurred glass, no drifting gradient blobs. Those read as generic
 * SaaS-template chrome; a real HelloTalk login screen doesn't need a backdrop effect to look
 * intentional, and this page borrows nothing that the rest of JilaliTalk doesn't already do.
 */
@Component({
  selector: 'app-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="auth-shell">
      <main class="auth-main" id="main-content" tabindex="-1">
        <a routerLink="/rooms" class="brand-mark" aria-label="JilaliTalk home">
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="authBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="var(--color-primary-500)"/>
                <stop offset="100%" stop-color="var(--color-accent-500)"/>
              </linearGradient>
            </defs>
            <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" fill="url(#authBrandGrad)"/>
            <path d="M16 8l-8 4v8l8 4 8-4v-8l-8-4z" fill="white" fill-opacity="0.25"/>
            <path d="M12 16l4-4 4 4-4 4-4-4z" fill="white"/>
          </svg>
          <span class="brand-name">JilaliTalk</span>
        </a>

        <section class="auth-card" role="region" [attr.aria-labelledby]="titleId">
          <header class="card-header">
            <span class="card-icon" aria-hidden="true">
              <ng-content select="[auth-icon]" />
            </span>
            <h1 class="card-title" [id]="titleId">{{ title() }}</h1>
            <p class="card-sub">
              <ng-content select="[auth-subtitle]" />
            </p>
          </header>

          <ng-content />

          <p class="alt">
            <ng-content select="[auth-footer]" />
          </p>
        </section>
      </main>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .auth-shell {
      min-height: 100dvh;
      min-height: 100svh;
      background: var(--color-bg);
    }

    .auth-main {
      min-height: 100dvh;
      min-height: 100svh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-6);
      padding: max(var(--space-8), env(safe-area-inset-top)) var(--space-4) max(var(--space-8), env(safe-area-inset-bottom));
    }

    .brand-mark {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      text-decoration: none;
      border-radius: var(--radius-md);
    }
    .brand-mark:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .brand-name {
      font-size: var(--text-base);
      font-weight: var(--font-bold);
      letter-spacing: -0.02em;
      color: var(--color-text-primary);
    }

    .auth-card {
      width: 100%;
      max-width: 380px;
      padding: var(--space-6) var(--space-6) var(--space-5);
      border-radius: var(--radius-xl);
      background: var(--color-card);
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }
    .dark .auth-card {
      background: var(--color-neutral-900);
      border-color: var(--color-neutral-800);
    }

    .card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      text-align: center;
    }
    .card-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-full);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary-50);
      color: var(--color-primary-600);
      margin-bottom: var(--space-1);
    }
    .dark .card-icon {
      background: color-mix(in srgb, var(--color-primary-600) 25%, transparent);
      color: var(--color-primary-300);
    }
    .card-title {
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.01em;
      color: var(--color-text-primary);
      margin: 0;
    }
    .card-sub {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
      max-width: 30ch;
    }
    .card-sub strong { color: var(--color-text-primary); font-weight: var(--font-medium); }

    .alt {
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
    }
  `],
})
export class AuthShellComponent {
  readonly title = input.required<string>();

  private static nextId = 0;
  protected readonly titleId = `auth-shell-title-${AuthShellComponent.nextId++}`;
}
