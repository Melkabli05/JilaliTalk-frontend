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
  /* See login-page.component.ts's identical rule for why this matters: without it, this
     route-level component defaults to display:inline and the auth-shell grid inside it
     overflows narrow viewports instead of being constrained by the page width. */
  host: { class: 'block' },
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

      <div class="flex items-start justify-center gap-0 -mt-2" role="group" aria-label="Sign-up steps">
        <div class="flex flex-col items-center gap-1">
          <span [class]="stepCircleClass(step() === 'account', step() === 'code')">
            @if (step() === 'code') {
              <svg aria-hidden="true" lucideCheck [size]="11" [strokeWidth]="3"></svg>
            } @else {
              1
            }
          </span>
          <span class="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Account</span>
        </div>
        <span
          class="w-10 h-0.5 mt-[11px] mx-2 shrink-0 transition-colors duration-200"
          [class]="step() === 'code' ? 'bg-blue-500' : 'bg-neutral-200 dark:bg-neutral-700'"
          aria-hidden="true"
        ></span>
        <div class="flex flex-col items-center gap-1">
          <span [class]="stepCircleClass(step() === 'code', false)">2</span>
          <span class="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Verify</span>
        </div>
      </div>
      <p class="sr-only" aria-live="polite">
        {{ step() === 'account' ? 'Step 1 of 2, account details' : 'Step 2 of 2, verify your email' }}
      </p>

      @if (step() === 'account') {
        <form class="flex flex-col gap-3" (submit)="onAccountSubmit($event)" novalidate>
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
            class="mt-2 w-full"
            [loading]="submitting()"
            [disabled]="!canSubmitAccount()"
          >
            Send verification code
          </app-button>
        </form>
      } @else {
        <form class="flex flex-col gap-3" (submit)="onCodeSubmit($event)" novalidate>
          <div class="flex flex-col gap-1">
            <label for="signup-code" class="sr-only">Verification code</label>
            <input
              id="signup-code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              [attr.maxlength]="codeLength"
              class="w-full h-14 px-4 border border-neutral-200 dark:border-neutral-700 rounded-md box-border
                     bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100
                     text-[28px] font-bold tracking-[16px] indent-[16px] text-center outline-none font-[inherit]
                     transition-[border-color,box-shadow] duration-150
                     placeholder:text-neutral-300 placeholder:tracking-[8px] placeholder:font-normal placeholder:text-xl
                     focus:border-blue-500 focus:shadow-[0_0_0_3px_rgb(59_130_246/10%)]"
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
            class="mt-2 w-full"
            [loading]="submitting()"
            [disabled]="code().length !== codeLength || submitting()"
          >
            Create account
          </app-button>

          <div class="flex items-center justify-between gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-0.5 border-0 bg-transparent text-neutral-500 dark:text-neutral-400
                     text-xs font-medium cursor-pointer p-2 transition-colors duration-150
                     hover:text-neutral-900 dark:hover:text-neutral-100
                     disabled:opacity-50 disabled:cursor-default
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 focus-visible:rounded-sm"
              [disabled]="submitting()"
              (click)="backToAccount()"
            >
              <svg aria-hidden="true" lucideChevronLeft [size]="13"></svg>
              Change email
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-0.5 border-0 bg-transparent text-neutral-500 dark:text-neutral-400
                     text-xs font-medium cursor-pointer p-2 transition-colors duration-150
                     hover:text-neutral-900 dark:hover:text-neutral-100
                     disabled:opacity-50 disabled:cursor-default
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 focus-visible:rounded-sm"
              [disabled]="submitting()"
              (click)="resendCode()"
            >
              Resend code
            </button>
          </div>
        </form>
      }

      <ng-container auth-footer>
        Already have an account?
        <a
          routerLink="/login"
          class="text-blue-600 dark:text-blue-400 no-underline font-medium hover:underline"
        >Sign in</a>
      </ng-container>
    </app-auth-shell>
  `,
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

  /** Full class string per step-circle state — "done" (checkmark, filled blue) takes
   *  priority over "active" (outlined blue) since a step can be both only transiently. */
  protected stepCircleClass(active: boolean, done: boolean): string {
    const base =
      'w-6 h-6 rounded-full border-2 flex items-center justify-center text-[11px] font-semibold ' +
      'transition-[background-color,border-color,color] duration-200 shrink-0';
    if (done) return `${base} border-blue-500 bg-blue-500 text-white`;
    if (active) return `${base} border-blue-500 text-blue-700 dark:text-blue-300 bg-white dark:bg-neutral-900`;
    return `${base} border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900`;
  }

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
