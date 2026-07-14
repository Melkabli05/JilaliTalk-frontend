import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogRef } from '@angular/cdk/dialog';
import {
  form,
  submit,
  required,
  validate,
  requiredError,
  emailError,
  minLengthError,
  FormField,
  FieldState,
} from '@angular/forms/signals';
import { InputComponent } from '../input/input.component';
import { AuthService, LoginRequest, RegisterRequest } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { httpErrorMessage } from '@shared/utils/http-error-message.util';

type AuthTab = 'login' | 'register';
type RegisterStep = 1 | 2 | 3;

const EMAIL_REQUIRED = 'Email is required';
const INVALID_EMAIL = 'That doesn\'t look like an email';
const PASSWORD_REQUIRED = 'Password is required';
const PASSWORD_MIN = 8;
const NICKNAME_REQUIRED = 'Pick a nickname';
const CODE_INVALID = 'Code must be 6 digits';

@Component({
  selector: 'app-auth-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, InputComponent],
  host: {
    'aria-labelledby': 'auth-nav-label',
  },
  template: `
    <div class="sr-only" aria-live="polite" aria-atomic="true" role="status">{{ announcer() }}</div>

    <div class="auth-backdrop" (click)="close()"></div>

    <div class="auth-card" role="document">

      <button type="button" class="close-btn" (click)="close()" aria-label="Close dialog, cancel authentication">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      @switch (view()) {
        @case ('success') {
          <div class="success-view" role="main">
            <div class="success-avatar" aria-hidden="true">{{ successInitial() }}</div>
            <h2 class="success-title" id="auth-dialog-heading">Welcome</h2>
            <p class="success-name" aria-live="polite">{{ successName() }}</p>
            <p class="success-hint">Your account is ready.</p>
            <button type="button" class="btn-primary-full" (click)="close()">
              Enter JilaliTalk
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
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
                [errorMessage]="fieldError(loginForm.email())"
              />
              <div class="password-field">
                <app-input
                  label="Password"
                  [type]="showPassword() ? 'text' : 'password'"
                  placeholder="Your password"
                  autocomplete="current-password"
                  enterkeyhint="done"
                  [formField]="loginForm.password"
                  [errorMessage]="fieldError(loginForm.password())"
                />
                <button type="button" class="password-toggle"
                  (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                  [attr.aria-pressed]="showPassword()">
                  @if (showPassword()) {
                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  } @else {
                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  }
                </button>
              </div>

              @if (errorMessage()) {
                <div class="error-banner" role="alert" aria-live="assertive">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {{ errorMessage() }}
                </div>
              }

              <button type="submit" class="btn-primary-full"
                [disabled]="loginForm().invalid() || loading()"
                [attr.aria-busy]="loading()">
                @if (loading()) {
                  <span class="spinner" aria-hidden="true"></span>
                  <span>Singing in…</span>
                } @else {
                  <span>Sign in</span>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                }
              </button>
            </form>
          }

          @if (activeTab() === 'register') {
            <form class="auth-form" (submit)="onRegisterSubmit($event)" aria-label="Create account" novalidate>

              <div class="step-progress" role="group" aria-label="Registration steps">
                @for (s of [1, 2, 3]; track s) {
                  <div class="step-item" [class.step-item--done]="regStep() > s">
                    <span class="step-circle" [class.step-circle--active]="regStep() === s">
                      @if (regStep() > s) {
                        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
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
                  [errorMessage]="fieldError(regForm1.email())"
                />
                <div class="password-field">
                  <app-input
                    label="Password"
                    [type]="showPassword() ? 'text' : 'password'"
                    placeholder="Choose a password"
                    autocomplete="new-password"
                    enterkeyhint="done"
                    [formField]="regForm1.password"
                    [errorMessage]="fieldError(regForm1.password())"
                  />
                  <button type="button" class="password-toggle"
                    (click)="showPassword.set(!showPassword())"
                    [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                    [attr.aria-pressed]="showPassword()">
                    @if (showPassword()) {
                      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    } @else {
                      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    }
                  </button>
                </div>

                @if (errorMessage()) {
                  <div class="error-banner" role="alert" aria-live="assertive">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {{ errorMessage() }}
                  </div>
                }

                <button type="submit" class="btn-primary-full"
                  [disabled]="regForm1().invalid() || sendingCode()"
                  [attr.aria-busy]="sendingCode()">
                  {{ sendingCode() ? 'Sending code…' : 'Next — Send Code' }}
                </button>
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
                    aria-describedby="code-error-msg"
                    [attr.aria-invalid]="codeError().length > 0"
                  />
                  @if (codeError().length > 0) {
                    <p id="code-error-msg" class="error-text" role="alert">{{ codeError() }}</p>
                  }
                </div>

                <button type="submit" class="btn-primary-full"
                  [disabled]="codeValue().length < 6 || verifyingCode()"
                  [attr.aria-busy]="verifyingCode()">
                  {{ verifyingCode() ? 'Verifying…' : 'Verify Code' }}
                </button>
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
                  [errorMessage]="fieldError(regForm3.nickname())"
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
                    <option value="MA">🇲🇦 Morocco</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="US">🇺🇸 United States</option>
                    <option value="GB">🇬🇧 United Kingdom</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="ES">🇪🇸 Spain</option>
                    <option value="IT">🇮🇹 Italy</option>
                    <option value="JP">🇯🇵 Japan</option>
                    <option value="CN">🇨🇳 China</option>
                    <option value="BR">🇧🇷 Brazil</option>
                    <option value="DZ">🇩🇿 Algeria</option>
                    <option value="EG">🇪🇬 Egypt</option>
                    <option value="SA">🇸🇦 Saudi Arabia</option>
                    <option value="AE">🇦🇪 UAE</option>
                    <option value="TR">🇹🇷 Turkey</option>
                    <option value="IN">🇮🇳 India</option>
                    <option value="KR">🇰🇷 South Korea</option>
                  </select>
                </div>

                @if (errorMessage()) {
                  <div class="error-banner" role="alert" aria-live="assertive">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {{ errorMessage() }}
                  </div>
                }

                <button type="submit" class="btn-primary-full"
                  [disabled]="regForm3().invalid() || !reg3Model().country || creatingAccount()"
                  [attr.aria-busy]="creatingAccount()">
                  {{ creatingAccount() ? 'Creating account…' : 'Create Account' }}
                </button>
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
      background: var(--color-warm-500); border-radius: 2px 2px 0 0;
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
    .password-toggle {
      position: absolute; right: var(--space-3); top: 18px;
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

    .error-banner {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-3); background: var(--color-error-50);
      border: 1px solid var(--color-error-200); border-radius: var(--radius-md);
      font-size: var(--text-xs); color: var(--color-error-700);
    }
    :host-context(.dark) .error-banner { background: var(--color-error-900); border-color: var(--color-error-700); color: var(--color-error-200); }
    .error-text { margin: 0; font-size: var(--text-xs); color: var(--color-error-600); }
    :host-context(.dark) .error-text { color: var(--color-error-300); }

    .btn-primary-full {
      width: 100%; padding: var(--space-3) var(--space-4); border: none;
      border-radius: var(--radius-md); background: var(--color-warm-500); color: var(--color-on-color);
      font-size: var(--text-sm); font-weight: var(--font-semibold); cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: var(--space-2);
      transition: background 0.15s, transform 0.1s; margin-top: var(--space-1);
    }
    .btn-primary-full:hover:not(:disabled) { background: var(--color-warm-600); }
    .btn-primary-full:active:not(:disabled) { transform: scale(0.99); }
    .btn-primary-full:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary-full:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }

    .btn-link {
      width: 100%; border: none; background: transparent;
      color: var(--color-text-muted); font-size: var(--text-xs); font-weight: var(--font-medium);
      cursor: pointer; padding: var(--space-2); text-align: center; transition: color 0.15s;
    }
    .btn-link:hover { color: var(--color-text); }
    .btn-link:focus-visible { outline: var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }

    .spinner {
      width: 14px; height: 14px; flex-shrink: 0;
      border: 2px solid hsl(0deg 0% 100% / 25%); border-top-color: var(--color-on-color);
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }

    .success-view {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: var(--space-4) 0 var(--space-2);
      animation: success-pop 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) both;
    }
    .success-avatar {
      width: 72px; height: 72px; border-radius: 50%;
      background: linear-gradient(135deg, var(--color-warm-400), var(--color-warm-500));
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: var(--font-bold); color: var(--color-on-color);
      box-shadow: 0 0 28px var(--color-warm-500 / 40%);
      margin-bottom: var(--space-4);
    }
    .success-title {
      font-size: var(--text-lg); font-weight: var(--font-bold); color: var(--color-text); margin: 0 0 var(--space-1);
    }
    .success-name { font-size: var(--text-sm); color: var(--color-warm-500); font-weight: var(--font-semibold); margin: 0 0 var(--space-2); }
    .success-hint { font-size: var(--text-xs); color: var(--color-text-muted); margin: 0 0 var(--space-6); }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes success-pop {
      0% { opacity: 0; transform: scale(0.8); }
      60% { transform: scale(1.05); }
      100% { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner { animation-duration: 1.2s; }
      .success-view { animation: none; }
    }

    @media (max-width: 640px) {
      .auth-card {
        padding: var(--space-5) var(--space-4) var(--space-5);
        max-height: calc(100dvh - var(--space-6));
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
      .close-btn {
        width: 44px; height: 44px;
      }
      .nav-tab {
        padding: var(--space-3) 0;
        min-height: 44px;
      }
      .password-toggle {
        width: 44px; height: 44px;
        top: 50%;
        transform: translateY(-50%);
      }
      .password-toggle:active { transform: translateY(-50%) scale(0.92); }
      .select-input {
        height: 44px;
        font-size: max(16px, var(--text-sm));
      }
      .btn-link {
        min-height: 44px;
        padding: var(--space-3) var(--space-2);
        font-size: var(--text-sm);
      }
      .error-text { font-size: var(--text-sm); }
      .step-line { width: 24px; margin: 0 2px; }
    }

    @media (max-height: 600px) {
      .auth-card { max-height: calc(100dvh - var(--space-3)); }
    }
  `],
})
export class AuthDialogComponent implements OnInit {
  private readonly ref = inject(DialogRef);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly announcer = signal('');

  readonly view = signal<'login' | 'register' | 'success'>('login');
  readonly activeTab = signal<AuthTab>('login');
  readonly regStep = signal<RegisterStep>(1);
  readonly loading = signal(false);
  readonly sendingCode = signal(false);
  readonly verifyingCode = signal(false);
  readonly creatingAccount = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly codeValue = signal('');
  readonly codeError = signal('');
  readonly reg1Email = signal('');

  readonly successName = signal('');
  readonly successInitial = computed(() => {
    const name = this.successName();
    return name ? name.charAt(0).toUpperCase() : '?';
  });

  private readonly loginModel = signal({ email: '', password: '' });
  readonly loginForm = form(this.loginModel, (path) => {
    validate(path.email, ({ value }) =>
      !value().trim()
        ? requiredError({ message: EMAIL_REQUIRED })
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value())
          ? emailError({ message: INVALID_EMAIL })
          : undefined,
    );
    required(path.password, { message: PASSWORD_REQUIRED });
  });

  private readonly reg1Model = signal({ email: '', password: '' });
  readonly regForm1 = form(this.reg1Model, (path) => {
    validate(path.email, ({ value }) =>
      !value().trim()
        ? requiredError({ message: EMAIL_REQUIRED })
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value())
          ? emailError({ message: INVALID_EMAIL })
          : undefined,
    );
    validate(path.password, ({ value }) =>
      value().trim().length === 0
        ? requiredError({ message: PASSWORD_REQUIRED })
        : value().length < PASSWORD_MIN
          ? minLengthError(PASSWORD_MIN, { message: `At least ${PASSWORD_MIN} characters` })
          : undefined,
    );
  });

  private readonly _reg3Model = signal<{ nickname: string; country: string }>({ nickname: '', country: '' });
  readonly reg3Model = this._reg3Model.asReadonly();
  readonly regForm3 = form(this._reg3Model, (path) => {
    required(path.nickname, { message: NICKNAME_REQUIRED });
  });

  ngOnInit(): void {
    this.focusFirstInput();
  }

  private announce(message: string): void {
    this.announcer.set('');
    setTimeout(() => this.announcer.set(message), 50);
  }

  private focusFirstInput(): void {
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[autocomplete="email"]');
      el?.focus();
    }, 80);
  }

  private focusCodeInput(): void {
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('#reg-code');
      el?.focus();
    }, 80);
  }

  private focusNickInput(): void {
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>('[autocomplete="nickname"]');
      el?.focus();
    }, 80);
  }

  fieldError(field: FieldState<string>): string {
    return field.touched() && field.errors().length > 0
      ? (field.errors()[0]?.message ?? '')
      : '';
  }

  private getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  switchTab(tab: AuthTab): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.codeError.set('');
    this.regStep.set(1);
    this.codeValue.set('');
  }

  close(): void { this.ref.close(); }

  onCodeInput(event: Event): void {
    const raw = this.getInputValue(event).replace(/\D/g, '').slice(0, 6);
    this.codeValue.set(raw);
    this.codeError.set('');
    (event.target as HTMLInputElement).value = raw;
  }

  onCountryChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this._reg3Model.update(m => ({ ...m, country: val }));
    void event;
  }

  async onLoginSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    await submit(this.loginForm, async () => {
      this.loading.set(true);
      this.announce('Signing in…');
      try {
        const req: LoginRequest = { email: this.loginModel().email.trim(), password: this.loginModel().password };
        this.authService.login(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (res) => { this.authStore.login(res.user); this.showSuccess(res.user.nickname); },
          error: (err: unknown) => {
            this.errorMessage.set(httpErrorMessage(err, 'Invalid email or password.'));
            this.announce(this.errorMessage() ?? '');
          },
        });
      } finally { this.loading.set(false); }
    });
  }

  async onRegisterSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    if (this.regStep() === 1) {
      await submit(this.regForm1, async () => {
        this.sendingCode.set(true);
        this.announce('Sending verification code…');
        this.reg1Email.set(this.reg1Model().email.trim());
        await new Promise(r => setTimeout(r, 900));
        this.sendingCode.set(false);
        this.regStep.set(2);
        this.announce('Code sent. Check your email. Step 2 of 3.');
        this.focusCodeInput();
      });
      return;
    }

    if (this.regStep() === 2) {
      if (this.codeValue().length < 6) {
        this.codeError.set(CODE_INVALID);
        return;
      }
      this.verifyingCode.set(true);
      this.announce('Verifying code…');
      await new Promise(r => setTimeout(r, 700));
      this.verifyingCode.set(false);
      this.regStep.set(3);
      this.announce('Code verified. Step 3 of 3. Complete your profile.');
      this.focusNickInput();
      return;
    }

    if (this.regStep() === 3) {
      this.creatingAccount.set(true);
      this.announce('Creating account…');
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
            this.announce(this.errorMessage() ?? '');
          },
        });
      } finally { this.creatingAccount.set(false); }
    }
  }

  resendCode(): void {
    this.codeValue.set('');
    this.codeError.set('');
    this.announce('Code resent. Check your email.');
  }

  private showSuccess(nickname: string): void {
    this.successName.set(nickname);
    this.view.set('success');
    this.announce('Welcome ' + nickname + '. You are now signed in.');
    setTimeout(() => this.ref.close(), 2800);
  }
}
