import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';

const DEFAULT_ERROR = { title: 'Error', message: 'Something went wrong.' };

const ERROR_CONFIG: Record<number, { title: string; message: string }> = {
  401: { title: 'Unauthorized', message: 'You need to log in to access this page.' },
  403: { title: 'Forbidden', message: "You don't have permission to access this page." },
  404: { title: 'Not Found', message: "The page you're looking for doesn't exist." },
  500: { title: 'Server Error', message: 'Something went wrong on our end. Please try again.' },
};

@Component({
  selector: 'app-error-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error-page">
      <h1 class="error-code">{{ code() }}</h1>
      <h2 class="error-title">{{ config.title }}</h2>
      <p class="error-message">{{ config.message }}</p>
      <div class="error-actions">
        <a routerLink="/" class="btn btn-primary">Go home</a>
        <button class="btn btn-ghost" (click)="goBack()">Go back</button>
      </div>
    </div>
  `,
  styles: [`
    .error-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100%;
      padding: var(--space-6);
      text-align: center;
    }

    .error-code {
      font-size: 80px;
      font-weight: 800;
      color: var(--color-primary-200);
      line-height: 1;
      margin: 0;
    }

    .error-title {
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: var(--space-2) 0 var(--space-1);
    }

    .error-message {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      max-width: 320px;
      margin: 0 0 var(--space-6);
    }

    .error-actions {
      display: flex;
      gap: var(--space-3);
    }

    .btn {
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-lg);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      cursor: pointer;
      border: none;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }

    .btn-primary {
      background: var(--color-primary-500);
      color: var(--color-on-color);
    }

    .btn-ghost {
      background: transparent;
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }
  `]
})
export class ErrorPageComponent {
  readonly code = input(404, {
    transform: (v: string | number | undefined) => Number(v) || 404,
  });

  get config() {
    return ERROR_CONFIG[this.code()] ?? DEFAULT_ERROR;
  }

  goBack(): void {
    history.back();
  }
}