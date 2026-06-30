import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';

export interface ConfirmOptions {
  readonly title?: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: 'default' | 'destructive';
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [ModalComponent, ButtonComponent, A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="data.title ?? 'Confirm'">
      <p class="confirm-message">{{ data.message }}</p>
      <div class="confirm-footer">
        <app-button type="button" variant="ghost" size="md" cdkFocusInitial (click)="onCancel()">
          {{ data.cancelLabel ?? 'Cancel' }}
        </app-button>
        <app-button
          type="button"
          [variant]="data.variant === 'destructive' ? 'destructive' : 'primary'"
          size="md"
          (click)="onConfirm()"
        >
          {{ data.confirmLabel ?? 'Confirm' }}
        </app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    :host {
      display: block;
      width: 320px;
      max-width: calc(100vw - var(--space-6));
    }

    .confirm-message {
      margin: 0 0 var(--space-4);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .confirm-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: var(--space-2);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
    }
  `],
})
export class ConfirmDialogComponent {
  private readonly ref = inject(DialogRef<boolean>);
  readonly data = inject<ConfirmOptions>(DIALOG_DATA);

  onConfirm(): void {
    this.ref.close(true);
  }

  onCancel(): void {
    this.ref.close(false);
  }
}
