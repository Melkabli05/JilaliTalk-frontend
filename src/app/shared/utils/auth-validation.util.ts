import { requiredError, emailError, minLengthError, type FieldState } from '@angular/forms/signals';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_REQUIRED = 'Email is required';
export const INVALID_EMAIL = 'Enter a valid email';
export const PASSWORD_REQUIRED = 'Password is required';
export const PASSWORD_MIN = 8;

export function validateEmail(value: () => string) {
  if (!value().trim()) return requiredError({ message: EMAIL_REQUIRED });
  if (!EMAIL_RE.test(value())) return emailError({ message: INVALID_EMAIL });
  return undefined;
}

export function validatePasswordMin(value: () => string) {
  if (value().trim().length === 0) return requiredError({ message: PASSWORD_REQUIRED });
  if (value().length < PASSWORD_MIN) return minLengthError(PASSWORD_MIN, { message: `At least ${PASSWORD_MIN} characters` });
  return undefined;
}

export function firstError(field: FieldState<string>): string {
  return field.touched() && field.errors().length > 0
    ? (field.errors()[0]?.message ?? '')
    : '';
}