import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, validate, FormField } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { LucideUserPlus } from '@lucide/angular';
import { InputComponent } from '@shared/ui/input/input.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { ErrorBannerComponent } from '@shared/ui/error-banner/error-banner.component';
import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { firstError, validateEmail, validatePasswordMin } from '@shared/utils/auth-validation.util';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';
import { sameOriginReturnUrl } from '../../utils/return-url.util';

type SignupStep = 'account' | 'code';

/**
 * Two real steps, not three: HelloTalk's signup pipeline (jilalibff's
 * `com.jilali.auth.HelloTalkAuthService`) has no endpoint that persists a nickname at
 * account-creation time — `/v3/check`'s upstream request is `{email, password,
 * emailVerifyCode}` only, confirmed from smali. A third "pick your nickname" step was in
 * the old mocked flow but never wired to anything real, so it's dropped here rather than
 * kept as UI theater. Users can set a nickname later once a real profile-edit endpoint
 * exists (see jilalibff's ProfileEditRequest docs for that gap).
 */
const CODE_LENGTH = 6;
const CODE_INVALID = `Enter the ${CODE_LENGTH}-digit code`;

@Component({
  selector: 'app-signup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormField, InputComponent, ButtonComponent, ErrorBannerComponent, LucideUserPlus],
  template: `
    <main class="signup-shell" aria-labelledby="signup-title">
      <section class="signup-card" role="region">
        <header class="card-header">
          <span class="card-icon" aria-hidden="true">
            <svg lucideUserPlus [size]="22"></svg>
          </span>
          <h1 class="card-title" id="signup-title">Create your JilaliTalk account</h1>
          <p class="card-sub">
            @if (step() === 'account') {
              Uses your real HelloTalk email and a new password.
            } @else {
              We sent a {{ codeLength }}-digit code to <strong>{{ accountModel().email }}</strong>
            }
          </p>
        </header>

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
                placeholder="000000"
                autocomplete="one-time-code"
                autocapitalize="off"
                enterkeyhint="go"
                [value]="code()"
                (input)="onCodeInput($event)"
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
            <button type="button" class="resend-btn" [disabled]="submitting()" (click)="resendCode()">
              Didn't get it? Send again
            </button>
          </form>
        }

        <p class="alt">
          Already have an account?
          <a routerLink="/login" class="alt-link">Sign in</a>
        </p>
      </section>
    </main>
  `,
  styles: [`
    .signup-shell {
      min-height: calc(100dvh - var(--app-header-height));
      display: grid;
      place-items: center;
      padding: var(--space-6) var(--space-4);
    }
    .signup-card {
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
    .dark .signup-card {
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
    .card-sub strong { color: var(--color-text-primary); font-weight: var(--font-medium); }
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
    .code-field { display: flex; flex-direction: column; gap: var(--space-1); }
    .code-input {
      width: 100%; height: 52px; padding: 0 var(--space-4);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-card); color: var(--color-text);
      font-size: 22px; font-weight: var(--font-bold); letter-spacing: 10px;
      text-align: center; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box; font-family: inherit;
    }
    .dark .code-input { background: var(--color-neutral-800); color: var(--color-neutral-100); }
    .code-input::placeholder { color: var(--color-neutral-300); letter-spacing: 4px; font-weight: var(--font-normal); font-size: 18px; }
    .code-input:focus {
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 10%, transparent);
    }
    .resend-btn {
      width: 100%; border: none; background: transparent;
      color: var(--color-text-muted); font-size: var(--text-xs); font-weight: var(--font-medium);
      cursor: pointer; padding: var(--space-2); text-align: center; transition: color 0.15s;
    }
    .resend-btn:hover { color: var(--color-text); }
    .resend-btn:disabled { opacity: 0.5; cursor: default; }
    .resend-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); border-radius: var(--radius-sm); }
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
export class SignupPageComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly codeLength = CODE_LENGTH;

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

  async resendCode(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.errorText.set(null);
    try {
      await this.sendCode();
      this.toast.success('Code sent again.');
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
      this.errorText.set(httpErrorMessage(err, CODE_INVALID + ' or the account could not be created.'));
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
