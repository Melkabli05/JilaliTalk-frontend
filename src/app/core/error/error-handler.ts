import { ErrorHandler, inject } from '@angular/core';
import { ERROR_REPORTER } from '@core/tokens/error-reporter.token';
import { isChunkLoadError } from './chunk-load-error.util';

let hasReloadedForChunkError = false;

export class AppErrorHandler extends ErrorHandler {
  private readonly reporter = inject(ERROR_REPORTER);

  override handleError(error: unknown): void {
    if (isChunkLoadError(error) && !hasReloadedForChunkError) {
      hasReloadedForChunkError = true;
      window.location.reload();
      return;
    }
    this.reporter.report(error, 'global');
    console.error('[GlobalErrorHandler]', error);
  }
}