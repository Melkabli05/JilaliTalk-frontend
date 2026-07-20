import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, validate, FormField } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { LucideUserPlus, LucideCheck, LucideChevronLeft } from '@lucide/angular';
import { InputComponent } from '@shared/ui/input/input.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { ErrorBannerComponent } from '@shared/ui/error-banner/error-banner.component';
import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { firstError, validateEmail, validatePasswordMin } from '@shared/utils/auth-validation.util';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';
import { sameOriginReturnUrl } from '../../utils/return-url.util';
import { AuthShellComponent } from '../../ui/auth-shell/auth-shell.component';
import { AutofocusDirective } from '@shared/directives';

type SignupStep = 'account' | 'code';

/**
 * Two real steps, not three: HelloTalk's signup pipeline (jilalibff's
 * `com.jilali.auth.HelloTalkAuthService`) has no endpoint that persists a nickname at
 * account-creation time — `/v3/check`'s upstream request is `{email, password,
 * emailVerifyCode}` only, confirmed from smali. A third "pick your nickname" step was in
 * the old mocked flow but never wired to anything real, so it's dropped here rather than
 * kept as UI theater. Users can set a nickname later once a real profile-edit endpoint
 * exists (see jilalibff's ProfileEditRequest docs for that gap).
 *
 * Code length is 4 digits — HelloTalk's real email-verification code, confirmed against a
 * live code received during testing (not the 6-digit placeholder the old mocked flow used).
 */
const CODE_LENGTH = 4;
const STEPS = ['account', 'code'] as const;

@Component({
  selector: 'app-signup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormField, InputComponent, ButtonComponent, ErrorBannerComponent, AuthShellComponent, AutofocusDirective, LucideUserPlus, LucideCheck, LucideChevronLeft],
  template: `
    <app-auth-shell title="Create your JilaliTalk account">
      <svg auth-icon aria-hidden="true" lucideUserPlus [size]="24"></svg>
      <span auth-subtitle>
        @if (step() === 'account') {
          Uses your real HelloTalk email and a new password.
        } @else {
          We sent a {{ codeLength }}-digit code to <strong>{{ accountModel().email }}</strong>
        }
      </span>

      <div class="step-progress" role="group" aria-label="Sign-up steps">
        <div class="step-item" [class.step-item--done]="step() === 'code'">
          <span class="step-circle" [class.step-circle--active]="step() === 'account'">
            @if (step() === 'code') {
              <svg aria-hidden="true" lucideCheck [size]="11" [strokeWidth]="3"></svg>
            } @else {
              1
            }
          </span>
          <span class="step-label">Account</span>
        </div>
        <span class="step-line" [class.step-line--done]="step() === 'code'" aria-hidden="true"></span>
        <div class="step-item">
          <span class="step-circle" [class.step-circle--active]="step() === 'code'">2</span>
          <span class="step-label">Verify</span>
        </div>
      </div>
      <p class="sr-only" aria-live="polite">
        {{ step() === 'account' ? 'Step 1 of 2, account details' : 'Step 2 of 2, verify your email' }}
      </p>

      @if (step() === 'account') {
        <form (submit)="onAccountSubmit($event)" novalidate>
          <app-input
            label="Email"
            type="email"
            placeholder="you@example.com"
            inputmode="email"
            autocomplete="email"
            enterkeyhint="next"
            [formField]="accountForm.email"
            [errorMessage]="firstError(accountForm.email())"
            [appAutofocus]="true"
          />

          <app-input
            label="Password"
            type="password"
            placeholder="At least 8 characters"
            autocomplete="new-password"
            enterkeyhint="go"
            [formField]="accountForm.password"
            [errorMessage]="firstError(accountForm.password())"
          />

          <app-error-banner [message]="errorText()" />

          <app-button
            type="submit"
            variant="primary"
            size="lg"
            class="submit-btn"
            [loading]="submitting()"
            [disabled]="!canSubmitAccount()"
          >
            Send verification code
          </app-button>
        </form>
      } @else {
        <form (submit)="onCodeSubmit($event)" novalidate>
          <div class="code-field">
            <label for="signup-code" class="sr-only">Verification code</label>
            <input
              id="signup-code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              [attr.maxlength]="codeLength"
              class="code-input"
              placeholder="0000"
              autocomplete="one-time-code"
              autocapitalize="off"
              enterkeyhint="go"
              [value]="code()"
              (input)="onCodeInput($event)"
              [appAutofocus]="true"
            />
          </div>

          <app-error-banner [message]="errorText()" />

          <app-button
            type="submit"
            variant="primary"
            size="lg"
            class="submit-btn"
            [loading]="submitting()"
            [disabled]="code().length !== codeLength || submitting()"
          >
            Create account
          </app-button>

          <div class="step-actions">
            <button type="button" class="text-link" [disabled]="submitting()" (click)="backToAccount()">
              <svg aria-hidden="true" lucideChevronLeft [size]="13"></svg>
              Change email
            </button>
            <button type="button" class="text-link" [disabled]="submitting()" (click)="resendCode()">
              Resend code
            </button>
          </div>
        </form>
      }

      <ng-container auth-footer>
        Already have an account?
        <a routerLink="/login" class="alt-link">Sign in</a>
      </ng-container>
    </app-auth-shell>
  `,
  styles: [`
    /* See login-page.component.ts's identical rule for why this matters: without it, this
       route-level component defaults to display:inline and the auth-shell grid inside it
       overflows narrow viewports instead of being constrained by the page width. */
    :host { display: block; }

    form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .submit-btn {
      margin-top: var(--space-2);
      width: 100%;
    }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0;
      margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0);
      white-space: nowrap; border: 0;
    }

    /* ── Step progress ── */
    .step-progress {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: 0;
      margin-top: calc(-1 * var(--space-2));
    }
    .step-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
    }
    .step-circle {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: var(--font-semibold);
      color: var(--color-text-muted);
      background: var(--color-card);
      transition: background 0.2s, border-color 0.2s, color 0.2s;
      flex-shrink: 0;
    }
    .step-circle--active {
      border-color: var(--color-primary-500);
      color: var(--color-primary-text);
    }
    .dark .step-circle--active { color: var(--color-primary-300); }
    .step-item--done .step-circle {
      border-color: var(--color-primary-500);
      background: var(--color-primary-500);
      color: var(--color-on-color);
    }
    .step-label {
      font-size: 11px;
      font-weight: var(--font-medium);
      color: var(--color-text-muted);
    }
    .step-line {
      width: 40px;
      height: 2px;
      background: var(--color-border);
      margin: 11px var(--space-2) 0;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    .step-line--done { background: var(--color-primary-500); }

    .code-field { display: flex; flex-direction: column; gap: var(--space-1); }
    .code-input {
      width: 100%; height: 56px; padding: 0 var(--space-4);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-card); color: var(--color-text);
      font-size: 28px; font-weight: var(--font-bold); letter-spacing: 16px;
      text-indent: 16px;
      text-align: center; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box; font-family: inherit;
    }
    .dark .code-input { background: var(--color-neutral-800); color: var(--color-neutral-100); }
    .code-input::placeholder { color: var(--color-neutral-300); letter-spacing: 8px; font-weight: var(--font-normal); font-size: 20px; }
    .code-input:focus {
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 10%, transparent);
    }

    .step-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .text-link {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: none; background: transparent;
      color: var(--color-text-muted); font-size: var(--text-xs); font-weight: var(--font-medium);
      cursor: pointer; padding: var(--space-2); transition: color 0.15s;
    }
    .text-link:hover { color: var(--color-text); }
    .text-link:disabled { opacity: 0.5; cursor: default; }
    .text-link:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); border-radius: var(--radius-sm); }
    .alt-link {
      color: var(--color-primary-text);
      text-decoration: none;
      font-weight: var(--font-medium);
    }
    .alt-link:hover { text-decoration: underline; }
    .dark .alt-link { color: var(--color-primary-400); }
  `],
})
export class SignupPageComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly codeLength = CODE_LENGTH;
  protected readonly steps = STEPS;

  readonly step = signal<SignupStep>('account');
  readonly submitting = signal(false);
  readonly errorText = signal<string | null>(null);
  readonly code = signal('');

  private readonly accountModelSignal = signal({ email: '', password: '' });
  readonly accountModel = this.accountModelSignal.asReadonly();
  readonly accountForm = form(this.accountModelSignal, (path) => {
    validate(path.email, ({ value }) => validateEmail(value));
    validate(path.password, ({ value }) => validatePasswordMin(value));
  });

  readonly canSubmitAccount = computed(() => this.accountForm().valid() && !this.submitting());

  protected readonly firstError = firstError;

  onCodeInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    this.code.set(raw);
    this.errorText.set(null);
    (event.target as HTMLInputElement).value = raw;
  }

  async onAccountSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmitAccount()) return;
    this.submitting.set(true);
    this.errorText.set(null);
    try {
      await this.sendCode();
      this.step.set('code');
    } catch (err) {
      this.errorText.set(httpErrorMessage(err, 'Could not send a verification code. Check your connection and try again.'));
    } finally {
      this.submitting.set(false);
    }
  }

  backToAccount(): void {
    this.step.set('account');
    this.errorText.set(null);
    this.code.set('');
  }

  async resendCode(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorText.set(null);
    try {
      await this.sendCode();
      this.toast.success('Verification code resent.');
    } catch (err) {
      this.errorText.set(httpErrorMessage(err, 'Could not resend the code. Try again shortly.'));
    } finally {
      this.submitting.set(false);
    }
  }

  async onCodeSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.code().length !== CODE_LENGTH || this.submitting()) return;
    this.submitting.set(true);
    this.errorText.set(null);
    try {
      const res = await firstValueFrom(this.authService.signupCheck({
        email: this.accountModel().email,
        password: this.accountModel().password,
        emailVerifyCode: this.code(),
      }));
      this.authStore.login(res.user);
      this.toast.success('Account created.');
      await this.router.navigateByUrl(this.returnUrl());
    } catch (err) {
      this.errorText.set(httpErrorMessage(err, 'That code is incorrect, or the account could not be created. Please try again.'));
    } finally {
      this.submitting.set(false);
    }
  }

  /** Fires the best-effort `reg/prepare` step alongside the real `send-email-code` call —
   *  a prepare failure is swallowed (see AuthService.signupPrepare docs) so it never blocks
   *  the step that actually matters. */
  private async sendCode(): Promise<void> {
    void firstValueFrom(this.authService.signupPrepare()).catch(() => {});
    await firstValueFrom(this.authService.signupSendEmailCode(this.accountModel().email));
  }

  private returnUrl(): string {
    return sameOriginReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }
}
