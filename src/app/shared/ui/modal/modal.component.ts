import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'app-modal',
  imports: [A11yModule, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-labelledby]': 'titleId',
    '(keydown.escape)': 'close()',
  },
  template: `
    <div class="modal-shell" cdkTrapFocusAutoCapture>
      @if (title()) {
        <header class="modal-header">
          <div class="header-left">
            <h2 class="modal-title" [id]="titleId">{{ title() }}</h2>
            @if (count()) {
              <span class="count-badge">{{ count() }}</span>
            }
          </div>
          <button type="button" class="close-btn" (click)="close()" aria-label="Close">
            <svg aria-hidden="true" lucideX [size]="14" />
          </button>
        </header>
      }
      <div class="modal-body" [class.no-padding]="noPadding()">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .modal-shell {
      position: relative;
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--_modal-radius, var(--radius-xl));
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--color-border);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }

    .modal-title {
      font-size: var(--text-base);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 var(--space-1);
      border-radius: var(--radius-full);
      background: var(--color-neutral-100);
      color: var(--color-text-secondary);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      flex-shrink: 0;
    }
    :host-context(.dark) .count-badge {
      background: var(--color-neutral-700);
      color: var(--color-neutral-200);
    }

    .close-btn {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full);
      border: none;
      background: var(--color-neutral-100);
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s, transform 0.15s;
    }
    .close-btn:hover {
      background: var(--color-neutral-200);
      color: var(--color-text);
      transform: rotate(90deg);
    }
    .close-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    :host-context(.dark) .close-btn { background: var(--color-neutral-700); color: var(--color-neutral-300); }
    :host-context(.dark) .close-btn:hover { background: var(--color-neutral-600); color: var(--color-neutral-100); }

    .modal-body { padding: var(--space-4) var(--space-5); }
    .modal-body.no-padding { padding: 0; }
  `],
})
export class ModalComponent {
  readonly ref = inject(DialogRef);

  readonly title = input<string>('');

  readonly count = input<number | null>(null);

  readonly noPadding = input(false);

  protected readonly titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;

  close(): void {
    this.ref.close();
  }
}
