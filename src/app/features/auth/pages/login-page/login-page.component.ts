import { Component, ChangeDetectionStrategy, signal, inject, computed, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, required, email, FormField } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { LucideLogIn } from '@lucide/angular';
import { InputComponent } from '@shared/ui/input/input.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { firstError } from '@shared/utils/auth-validation.util';
import { sameOriginReturnUrl } from '../../utils/return-url.util';
import { ErrorBannerComponent } from '@shared/ui/error-banner/error-banner.component';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormField, InputComponent, ButtonComponent, ErrorBannerComponent, LucideLogIn],
  template: `
    <main class="login-shell" aria-labelledby="login-title">
      <section class="login-card" role="region">
        <header class="card-header">
          <span class="card-icon" aria-hidden="true">
            <svg lucideLogIn [size]="22"></svg>
          </span>
          <h1 class="card-title" id="login-title">Sign in to JilaliTalk</h1>
          <p class="card-sub">Use your HelloTalk email and password.</p>
        </header>

        <form (submit)="onSubmit($event)" novalidate>
          <app-input
            label="Email"
            type="email"
            placeholder="you@example.com"
            inputmode="email"
            autocomplete="email"
            enterkeyhint="next"
            [formField]="loginForm.email"
            [errorMessage]="firstError(loginForm.email())"
          />

          <app-input
            label="Password"
            type="password"
            placeholder="Your password"
            autocomplete="current-password"
            enterkeyhint="go"
            [formField]="loginForm.password"
            [errorMessage]="firstError(loginForm.password())"
          />

          <app-error-banner [message]="errorText()" />

          <app-button
            type="submit"
            variant="primary"
            size="lg"
            class="submit-btn"
            [loading]="submitting()"
            [disabled]="!canSubmit()"
          >
            Sign in
          </app-button>
        </form>

        <p class="alt">
          No account?
          <a routerLink="/signup" class="alt-link">Create one</a>
        </p>
      </section>
    </main>
  `,
  styles: [`
    .login-shell {
      min-height: calc(100dvh - var(--app-header-height));
      display: grid;
      place-items: center;
      padding: var(--space-6) var(--space-4);
    }
    .login-card {
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
    .dark .login-card {
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
      width: 48px;
      height: 48px;
      border-radius: var(--radius-full);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--color-primary-500) 14%, transparent);
      color: var(--color-primary-600);
      margin-bottom: var(--space-1);
    }
    .dark .card-icon {
      background: color-mix(in srgb, var(--color-primary-400) 18%, transparent);
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
    }
    form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .submit-btn {
      margin-top: var(--space-2);
      width: 100%;
    }
    .alt {
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
    }
    .alt-link {
      color: var(--color-primary-600);
      text-decoration: none;
      font-weight: var(--font-medium);
    }
    .alt-link:hover { text-decoration: underline; }
    .dark .alt-link { color: var(--color-primary-400); }
  `],
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly submitting = signal(false);
  readonly errorText = signal<string | null>(null);

  private readonly loginModel = signal({ email: '', password: '' });
  readonly loginForm = form(this.loginModel, (path) => {
    required(path.email, { message: 'Email is required' });
    email(path.email, { message: 'Enter a valid email' });
    required(path.password, { message: 'Password is required' });
  });

  readonly canSubmit = computed(() => this.loginForm().valid() && !this.submitting());

  constructor() {
    effect(() => {
      if (this.authStore.isAuthenticated()) {
        void this.router.navigateByUrl(this.returnUrl());
      }
    });
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.errorText.set(null);
    try {
      const res = await firstValueFrom(this.authService.login({
        email: this.loginModel().email,
        password: this.loginModel().password,
      }));
      this.authStore.login(res.user);
      this.toast.success('Signed in.');
      await this.router.navigateByUrl(this.returnUrl());
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : 0;
      this.errorText.set(
        status === 401
          ? 'Wrong email or password.'
          : 'Could not sign in. Check your connection and try again.'
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected readonly firstError = firstError;

  private returnUrl(): string {
    return sameOriginReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }
}