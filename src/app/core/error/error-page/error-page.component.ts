import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';

const DEFAULT_ERROR = { title: 'Error', message: 'Something went wrong.' };

const ERROR_CONFIG: Record<number, { title: string; message: string }> = {
  401: { title: 'Session expired', message: 'Your session could not be verified. Reload the page to reconnect.' },
  403: { title: 'Forbidden', message: "You don't have permission to access this page." },
  404: { title: 'Not Found', message: "The page you're looking for doesn't exist." },
  500: { title: 'Server Error', message: 'Something went wrong on our end. Please try again.' },
};

const RELOAD_CODES = new Set([401, 500]);

@Component({
  selector: 'app-error-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-page.component.html',
  styleUrl: './error-page.component.scss',
})
export class ErrorPageComponent {
  readonly code = input(404, {
    transform: (v: string | number | undefined) => Number(v) || 404,
  });

  get config() {
    return ERROR_CONFIG[this.code()] ?? DEFAULT_ERROR;
  }

  get showReload(): boolean {
    return RELOAD_CODES.has(this.code());
  }

  reload(): void {
    location.reload();
  }

  goBack(): void {
    history.back();
  }
}