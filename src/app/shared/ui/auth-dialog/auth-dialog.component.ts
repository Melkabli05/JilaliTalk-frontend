import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogRef } from '@angular/cdk/dialog';
import {
  form,
  submit,
  required,
  validate,
  FormField,
} from '@angular/forms/signals';
import { InputComponent } from '../input/input.component';
import { ButtonComponent } from '../button/button.component';
import { ErrorBannerComponent } from '../error-banner/error-banner.component';
import { AuthSuccessViewComponent } from '../auth-success-view/auth-success-view.component';
import { AutofocusDirective } from '@shared/directives';
import { pickCountries, type CountryEntry } from '@shared/data/countries';
import { SrAnnouncer } from '@shared/utils/sr-announcer';
import {
  firstError,
  validateEmail,
  validatePasswordMin,
  NICKNAME_REQUIRED,
} from '@shared/utils/auth-validation.util';
import { AuthService, LoginRequest, RegisterRequest } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';
import { LucideArrowRight, LucideX, LucideCheck, LucideEye, LucideEyeOff } from '@lucide/angular';

type AuthTab = 'login' | 'register';
type RegisterStep = 1 | 2 | 3;
type AuthPhase = 'idle' | 'login' | 'sendCode' | 'verifyCode' | 'createAccount';

const STEPS = [1, 2, 3] as const;
const CODE_INVALID = 'Code must be 6 digits';
const SUCCESS_AUTO_CLOSE_MS = 2800;

@Component({
  selector: 'app-auth-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    InputComponent,
    ButtonComponent,
    ErrorBannerComponent,
    AuthSuccessViewComponent,
    AutofocusDirective,
    LucideArrowRight,
    LucideX,
    LucideCheck,
    LucideEye,
    LucideEyeOff,
  ],
  host: {
    'aria-labelledby': 'auth-nav-label',
  },
  template: `
    <div class="sr-only" aria-live="polite" aria-atomic="true" role="status">{{ announcer.message() }}</div>

    <div class="auth-backdrop" (click)="close()"></div>

    <div class="auth-card" role="document">

      <button type="button" class="close-btn" (click)="close()" aria-label="Close dialog, cancel authentication">
        <svg aria-hidden="true" lucideX [size]="16"></svg>
      </button>

      @switch (view()) {
        @case ('success') {
          <app-auth-success-view [nickname]="successName()" (enter)="close()" />
        }

        @default {
          <nav class="auth-nav" id="auth-nav-label" role="tablist" aria-label="Sign in or create account">
            <button type="button" role="tab" class="nav-tab"
              [class.active]="activeTab() === 'login'"
              [attr.aria-selected]="activeTab() === 'login'"
              [attr.tabindex]="activeTab() === 'login' ? 0 : -1"
              (click)="switchTab('login')">Sign in</button>
            <button type="button" role="tab" class="nav-tab"
              [class.active]="activeTab() === 'register'"
              [attr.aria-selected]="activeTab() === 'register'"
              [attr.tabindex]="activeTab() === 'register' ? 0 : -1"
              (click)="switchTab('register')">Create account</button>
            <span class="tab-indicator" [class.tab-indicator--right]="activeTab() === 'register'" aria-hidden="true"></span>
          </nav>

          @if (activeTab() === 'login') {
            <form class="auth-form" (submit)="onLoginSubmit($event)" aria-label="Sign in" novalidate>
              <app-input
                label="Email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                inputmode="email"
                enterkeyhint="next"
                [formField]="loginForm.email"
                [errorMessage]="firstError(loginForm.email())"
                [appAutofocus]="activeTab()"
              />
              <div class="password-field">
                <app-input
                  label="Password"
                  [type]="showPassword() ? 'text' : 'password'"
                  placeholder="Your password"
                  autocomplete="current-password"
                  enterkeyhint="done"
                  [formField]="loginForm.password"
                  [errorMessage]="firstError(loginForm.password())"
                />
                <span class="password-toggle-slot">
                  <button type="button" class="password-toggle"
                    (click)="showPassword.set(!showPassword())"
                    [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                    [attr.aria-pressed]="showPassword()"
                  >
                    @if (showPassword()) {
                      <svg aria-hidden="true" lucideEyeOff [size]="15"></svg>
                    } @else {
                      <svg aria-hidden="true" lucideEye [size]="15"></svg>
                    }
                  </button>
                </span>
              </div>

              <app-error-banner [message]="errorMessage()" />

              <app-button
                type="submit"
                variant="primary"
                size="md"
                [disabled]="loginForm().invalid() || isLoading()"
                [loading]="phase() === 'login'"
              >
                @if (phase() === 'login') {
                  <span>Signing in…</span>
                } @else {
                  <span>Sign in</span>
                  <svg aria-hidden="true" lucideArrowRight [size]="14"></svg>
                }
              </app-button>
            </form>
          }

          @if (activeTab() === 'register') {
            <form class="auth-form" (submit)="onRegisterSubmit($event)" aria-label="Create account" novalidate>

              <div class="step-progress" role="group" aria-label="Registration steps">
                @for (s of steps; track s) {
                  <div class="step-item" [class.step-item--done]="regStep() > s">
                    <span class="step-circle" [class.step-circle--active]="regStep() === s">
                      @if (regStep() > s) {
                        <svg aria-hidden="true" lucideCheck [size]="10" [strokeWidth]="3"></svg>
                      } @else {
                        {{ s }}
                      }
                    </span>
                    @if (s < 3) {
                      <span class="step-line" [class.step-line--done]="regStep() > s" aria-hidden="true"></span>
                    }
                  </div>
                }
              </div>
              <p class="sr-only" aria-live="polite">Step {{ regStep() }} of 3{{ regStep() === 1 ? ', account details' : regStep() === 2 ? ', verify code' : ', complete profile' }}</p>

              @if (regStep() === 1) {
                <p class="step-section-label">Account details</p>
                <app-input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  autocomplete="email"
                  inputmode="email"
                  enterkeyhint="next"
                  [formField]="regForm1.email"
                  [errorMessage]="firstError(regForm1.email())"
                  [appAutofocus]="regStep()"
                />
                <div class="password-field">
                  <app-input
                    label="Password"
                    [type]="showPassword() ? 'text' : 'password'"
                    placeholder="Choose a password"
                    autocomplete="new-password"
                    enterkeyhint="done"
                    [formField]="regForm1.password"
                    [errorMessage]="firstError(regForm1.password())"
                  />
                  <span class="password-toggle-slot">
                    <button type="button" class="password-toggle"
                      (click)="showPassword.set(!showPassword())"
                      [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                      [attr.aria-pressed]="showPassword()"
                    >
                      @if (showPassword()) {
                        <svg aria-hidden="true" lucideEyeOff [size]="15"></svg>
                      } @else {
                        <svg aria-hidden="true" lucideEye [size]="15"></svg>
                      }
                    </button>
                  </span>
                </div>

                <app-error-banner [message]="errorMessage()" />

                <app-button
                  type="submit"
                  variant="primary"
                  size="md"
                  [disabled]="regForm1().invalid() || isLoading()"
                  [loading]="phase() === 'sendCode'"
                >
                  {{ phase() === 'sendCode' ? 'Sending code…' : 'Next — Send Code' }}
                </app-button>
              }

              @if (regStep() === 2) {
                <p class="step-section-label">Check your email</p>
                <p class="step-hint">We sent a 6-digit code to <strong>{{ reg1Email() }}</strong></p>

                <div class="code-field">
                  <label for="reg-code" class="sr-only">Verification code</label>
                  <input
                    id="reg-code"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    maxlength="6"
                    class="code-input"
                    [class.code-input--error]="codeError().length > 0"
                    placeholder="000000"
                    autocomplete="one-time-code"
                    autocapitalize="off"
                    enterkeyhint="done"
                    [value]="codeValue()"
                    (input)="onCodeInput($event)"
                    [appAutofocus]="regStep()"
                    aria-describedby="code-error-msg"
                    [attr.aria-invalid]="codeError().length > 0"
                  />
                  @if (codeError().length > 0) {
                    <p id="code-error-msg" class="error-text" role="alert">{{ codeError() }}</p>
                  }
                </div>

                <app-button
                  type="submit"
                  variant="primary"
                  size="md"
                  [disabled]="codeValue().length < 6 || isLoading()"
                  [loading]="phase() === 'verifyCode'"
                >
                  {{ phase() === 'verifyCode' ? 'Verifying…' : 'Verify Code' }}
                </app-button>
                <button type="button" class="btn-link" (click)="resendCode()">Didn't receive it? Send again</button>
              }

              @if (regStep() === 3) {
                <p class="step-section-label">Complete your profile</p>

                <app-input
                  label="Nickname"
                  type="text"
                  placeholder="How should people call you?"
                  autocomplete="nickname"
                  autocapitalize="words"
                  enterkeyhint="done"
                  [formField]="regForm3.nickname"
                  [errorMessage]="firstError(regForm3.nickname())"
                  [appAutofocus]="regStep()"
                />

                <div class="field-group">
                  <label for="reg-gender" class="field-label">Gender</label>
                  <select id="reg-gender" class="select-input">
                    <option value="">Prefer not to say</option>
                    <option value="1">Male</option>
                    <option value="0">Female</option>
                  </select>
                </div>

                <div class="field-group">
                  <label for="reg-country" class="field-label">Country</label>
                  <select id="reg-country" class="select-input" (change)="onCountryChange($event)">
                    <option value="">Select your country</option>
                    @for (c of countryOptions; track c.code) {
                      <option [value]="c.code">{{ c.flag }} {{ c.name }}</option>
                    }
                  </select>
                </div>

                <app-error-banner [message]="errorMessage()" />

                <app-button
                  type="submit"
                  variant="primary"
                  size="md"
                  [disabled]="regForm3().invalid() || !reg3Model().country || isLoading()"
                  [loading]="phase() === 'createAccount'"
                >
                  {{ phase() === 'createAccount' ? 'Creating account…' : 'Create Account' }}
                </app-button>
              }
            </form>
          }
        }
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }

    button,
    input,
    select,
    textarea {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0;
      margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0);
      white-space: nowrap; border: 0;
    }

    .auth-backdrop {
      position: fixed; inset: 0;
      background: hsl(0deg 0% 0% / 55%);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: -1;
    }

    .auth-card {
      position: relative;
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: 20px;
      padding: var(--space-7) var(--space-6) var(--space-7);
      width: 360px;
      max-width: calc(100vw - var(--space-8));
      box-shadow: var(--shadow-modal);
    }

    .close-btn {
      position: absolute; top: var(--space-3); right: var(--space-3);
      width: 28px; height: 28px;
      border-radius: var(--radius-md); border: none;
      background: transparent; color: var(--color-text-muted);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s; z-index: 2;
    }
    .close-btn:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .close-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .close-btn:active { transform: scale(0.95); }
    :host-context(.dark) .close-btn:hover { background: var(--color-neutral-700); color: var(--color-neutral-100); }

    .auth-nav {
      position: relative; display: flex;
      margin-bottom: var(--space-5);
      border-bottom: 1px solid var(--color-border);
    }
    .nav-tab {
      flex: 1; padding: var(--space-2) 0; border: none; background: transparent;
      font-size: var(--text-sm); font-weight: var(--font-semibold);
      color: var(--color-text-muted); cursor: pointer; transition: color 0.2s;
    }
    .nav-tab:focus-visible { outline: var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }
    .nav-tab.active { color: var(--color-text); }
    .tab-indicator {
      position: absolute; bottom: -1px; left: 0;
      width: calc(50% - var(--space-1)); height: 2px;
      background: var(--color-warm-500); border-radius: 2px 0 0 0;
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .tab-indicator--right { transform: translateX(calc(100% + var(--space-2))); }

    .step-progress {
      display: flex; align-items: center; justify-content: center;
      margin-bottom: var(--space-5); gap: 0;
    }
    .step-item { display: flex; align-items: center; }
    .step-circle {
      width: 24px; height: 24px; border-radius: 50%;
      border: 2px solid var(--color-neutral-300);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: var(--font-semibold);
      color: var(--color-text-muted); background: transparent;
      transition: background 0.2s, border-color 0.2s, color 0.2s;
      flex-shrink: 0;
    }
    :host-context(.dark) .step-circle { border-color: var(--color-neutral-600); }
    .step-circle--active {
      border-color: var(--color-warm-500); background: var(--color-warm-500); color: var(--color-on-color);
    }
    .step-item--done .step-circle {
      border-color: var(--color-accent-500); background: var(--color-accent-500); color: var(--color-on-color);
    }
    :host-context(.dark) .step-circle--active { background: var(--color-warm-400); }
    :host-context(.dark) .step-item--done .step-circle { background: var(--color-accent-400); }
    .step-line {
      width: 32px; height: 2px; background: var(--color-neutral-200); margin: 0 4px; transition: background 0.2s;
    }
    :host-context(.dark) .step-line { background: var(--color-neutral-600); }
    .step-line--done { background: var(--color-accent-500); }

    .step-section-label {
      font-size: var(--text-sm); font-weight: var(--font-semibold);
      color: var(--color-text); margin: 0 0 var(--space-3);
    }
    .step-hint {
      font-size: var(--text-xs); color: var(--color-text-muted); margin: 0 0 var(--space-4);
    }
    .step-hint strong { color: var(--color-text); font-weight: var(--font-medium); }

    .auth-form { display: flex; flex-direction: column; gap: var(--space-3); }

    .password-field { position: relative; }
    .password-toggle-slot {
      position: absolute; right: var(--space-2);
      top: 50%; bottom: auto;
      transform: translateY(-50%);
      display: flex; align-items: center; justify-content: center;
    }
    .password-toggle {
      border: none; background: transparent;
      color: var(--color-text-muted); cursor: pointer;
      padding: var(--space-1); display: flex; align-items: center;
      transition: color 0.15s;
    }
    .password-toggle:hover { color: var(--color-text); }
    .password-toggle:focus-visible { outline: var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }

    .field-group { display: flex; flex-direction: column; gap: var(--space-1); }
    .field-label {
      font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text);
    }
    :host-context(.dark) .field-label { color: var(--color-neutral-200); }
    .select-input {
      height: 36px; padding: 0 var(--space-3);
      border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-card); color: var(--color-text);
      font-size: var(--text-sm); outline: none;
      transition: border-color 0.15s, box-shadow 0.15s; cursor: pointer; appearance: auto;
    }
    .select-input:focus {
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 10%, transparent);
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
    .code-input::placeholder { color: var(--color-neutral-300); letter-spacing: 4px; font-weight: var(--font-normal); font-size: 18px; }
    .code-input:focus {
      border-color: var(--color-primary-500);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 10%, transparent);
    }
    .code-input--error { border-color: var(--color-error-500); }
    .code-input--error:focus { box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error-500) 10%, transparent); }

    .error-text { margin: 0; font-size: var(--text-xs); color: var(--color-error-600); }
    :host-context(.dark) .error-text { color: var(--color-error-300); }

    .btn-link {
      width: 100%; border: none; background: transparent;
      color: var(--color-text-muted); font-size: var(--text-xs); font-weight: var(--font-medium);
      cursor: pointer; padding: var(--space-2); text-align: center; transition: color 0.15s;
    }
    .btn-link:hover { color: var(--color-text); }
    .btn-link:focus-visible { outline: var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }

    @media (max-width: 640px) {
      .auth-card {
        padding: var(--space-5) var(--space-4) var(--space-5);
        max-height: calc(100dvh - var(--space-6));
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
      .close-btn { width: 44px; height: 44px; }
      .nav-tab { padding: var(--space-3) 0; min-height: 44px; }
      .password-toggle-slot {
        width: 44px; height: 44px;
      }
      .select-input { height: 44px; font-size: max(16px, var(--text-sm)); }
      .btn-link { min-height: 44px; padding: var(--space-3) var(--space-2); font-size: var(--text-sm); }
      .error-text { font-size: var(--text-sm); }
      .step-line { width: 24px; margin: 0 2px; }
    }

    @media (max-height: 600px) {
      .auth-card { max-height: calc(100dvh - var(--space-3)); }
    }
  `],
})
export class AuthDialogComponent {
  private readonly ref = inject(DialogRef);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly announcer = inject(SrAnnouncer);

  protected readonly steps = STEPS;

  protected readonly countryOptions: readonly CountryEntry[] = pickCountries([
    'MA', 'FR', 'US', 'GB', 'DE', 'ES', 'IT',
    'JP', 'CN', 'BR', 'DZ', 'EG', 'SA', 'AE',
    'TR', 'IN', 'KR',
  ]);

  readonly view = signal<'login' | 'register' | 'success'>('login');
  readonly activeTab = signal<AuthTab>('login');
  readonly regStep = signal<RegisterStep>(1);
  readonly phase = signal<AuthPhase>('idle');
  readonly isLoading = computed(() => this.phase() !== 'idle');
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly codeValue = signal('');
  readonly codeError = signal('');
  readonly reg1Email = signal('');
  readonly successName = signal('');

  private readonly loginModel = signal({ email: '', password: '' });
  readonly loginForm = form(this.loginModel, (path) => {
    validate(path.email, ({ value }) => validateEmail(value));
    required(path.password, { message: 'Password is required' });
  });

  private readonly reg1Model = signal({ email: '', password: '' });
  readonly regForm1 = form(this.reg1Model, (path) => {
    validate(path.email, ({ value }) => validateEmail(value));
    validate(path.password, ({ value }) => validatePasswordMin(value));
  });

  private readonly _reg3Model = signal<{ nickname: string; country: string }>({ nickname: '', country: '' });
  readonly reg3Model = this._reg3Model.asReadonly();
  readonly regForm3 = form(this._reg3Model, (path) => {
    required(path.nickname, { message: NICKNAME_REQUIRED });
  });

  protected readonly firstError = firstError;

  switchTab(tab: AuthTab): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.codeError.set('');
    this.regStep.set(1);
    this.codeValue.set('');
  }

  close(): void {
    if (this.successCloseTimer !== null) {
      clearTimeout(this.successCloseTimer);
      this.successCloseTimer = null;
    }
    this.ref.close();
  }

  onCodeInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
    this.codeValue.set(raw);
    this.codeError.set('');
    (event.target as HTMLInputElement).value = raw;
  }

  onCountryChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this._reg3Model.update(m => ({ ...m, country: val }));
  }

  async onLoginSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    await submit(this.loginForm, async () => {
      this.phase.set('login');
      this.announcer.announce('Signing in…');
      try {
        const req: LoginRequest = { email: this.loginModel().email.trim(), password: this.loginModel().password };
        this.authService.login(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (res) => { this.authStore.login(res.user); this.showSuccess(res.user.nickname); },
          error: (err: unknown) => {
            this.errorMessage.set(httpErrorMessage(err, 'Invalid email or password.'));
            this.announcer.announce(this.errorMessage() ?? '');
          },
        });
      } finally { this.phase.set('idle'); }
    });
  }

  async onRegisterSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    if (this.regStep() === 1) {
      await submit(this.regForm1, async () => {
        this.phase.set('sendCode');
        this.announcer.announce('Sending verification code…');
        this.reg1Email.set(this.reg1Model().email.trim());
        await new Promise(r => setTimeout(r, 900));
        this.phase.set('idle');
        this.regStep.set(2);
        this.announcer.announce('Code sent. Check your email. Step 2 of 3.');
      });
      return;
    }

    if (this.regStep() === 2) {
      if (this.codeValue().length < 6) {
        this.codeError.set(CODE_INVALID);
        return;
      }
      this.phase.set('verifyCode');
      this.announcer.announce('Verifying code…');
      await new Promise(r => setTimeout(r, 700));
      this.phase.set('idle');
      this.regStep.set(3);
      this.announcer.announce('Code verified. Step 3 of 3. Complete your profile.');
      return;
    }

    if (this.regStep() === 3) {
      this.phase.set('createAccount');
      this.announcer.announce('Creating account…');
      try {
        const req: RegisterRequest = {
          nickname: this.reg3Model().nickname.trim(),
          email: this.reg1Model().email.trim(),
          password: this.reg1Model().password,
        };
        this.authService.register(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (res) => { this.authStore.login(res.user); this.showSuccess(res.user.nickname); },
          error: (err: unknown) => {
            this.errorMessage.set(httpErrorMessage(err, 'Could not create your account.'));
            this.announcer.announce(this.errorMessage() ?? '');
          },
        });
      } finally { this.phase.set('idle'); }
    }
  }

  resendCode(): void {
    this.codeValue.set('');
    this.codeError.set('');
    this.announcer.announce('Code resent. Check your email.');
  }

  private successCloseTimer: ReturnType<typeof setTimeout> | null = null;

  private showSuccess(nickname: string): void {
    this.successName.set(nickname);
    this.view.set('success');
    this.announcer.announce('Welcome ' + nickname + '. You are now signed in.');
    this.successCloseTimer = setTimeout(() => {
      this.successCloseTimer = null;
      this.ref.close();
    }, SUCCESS_AUTO_CLOSE_MS);
  }
}