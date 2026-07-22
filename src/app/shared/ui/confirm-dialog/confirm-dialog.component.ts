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
  host: { class: 'block w-80 max-w-[calc(100vw-1.5rem)]' },
  template: `
    <app-modal [title]="data.title ?? 'Confirm'">
      <p class="m-0 mb-4 text-sm text-neutral-600 dark:text-neutral-300 leading-normal">{{ data.message }}</p>
      <div class="flex justify-end items-center gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-700">
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
