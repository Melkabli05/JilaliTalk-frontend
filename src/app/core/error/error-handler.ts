import { ErrorHandler, inject } from '@angular/core';
import { ERROR_REPORTER } from '@core/tokens/error-reporter.token';

export class AppErrorHandler extends ErrorHandler {
  private readonly reporter = inject(ERROR_REPORTER);

  override handleError(error: unknown): void {
    this.reporter.report(error, 'global');
    console.error('[GlobalErrorHandler]', error);
  }
}