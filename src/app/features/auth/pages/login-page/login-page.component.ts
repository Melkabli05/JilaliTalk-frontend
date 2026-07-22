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
import { AuthShellComponent } from '../../ui/auth-shell/auth-shell.component';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormField, InputComponent, ButtonComponent, ErrorBannerComponent, AuthShellComponent, LucideLogIn],
  /* Route-level component with no explicit display defaults to CSS's inline for unknown
     elements — AuthShellComponent's own :host is display:contents, so without this the
     whole chain down to .auth-shell (display:grid) never gets a proper block-level
     ancestor, and the grid is free to size to its content's max-content width instead of
     the viewport. That's what caused the page to overflow horizontally on narrow phones. */
  host: { class: 'block' },
  template: `
    <app-auth-shell title="Sign in to JilaliTalk">
      <svg auth-icon aria-hidden="true" lucideLogIn [size]="24"></svg>
      <span auth-subtitle>Use your HelloTalk email and password.</span>

      <form class="flex flex-col gap-3" (submit)="onSubmit($event)" novalidate>
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
          class="mt-2 w-full"
          [loading]="submitting()"
          [disabled]="!canSubmit()"
        >
          Sign in
        </app-button>
      </form>

      <ng-container auth-footer>
        No account?
        <a
          routerLink="/signup"
          class="text-blue-600 dark:text-blue-400 no-underline font-medium hover:underline"
        >Create one</a>
      </ng-container>
    </app-auth-shell>
  `,
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly submitting = signal(false);
  readonly errorText = signal<string | null>(null);

  // TODO: temporary test-account defaults for manual QA — remove before any real release.
  private readonly loginModel = signal({ email: 'cahaja5804@bittnex.com', password: '12345678' });
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
