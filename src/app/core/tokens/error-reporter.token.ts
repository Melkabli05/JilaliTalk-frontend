import { InjectionToken } from '@angular/core';

export interface ErrorReporter {
  report(error: unknown, context?: string): void;
}

export const ERROR_REPORTER = new InjectionToken<ErrorReporter>('ERROR_REPORTER', {
  factory: () => ({
    report: (error: unknown) => console.error('[ErrorReporter]', error),
  }),
});