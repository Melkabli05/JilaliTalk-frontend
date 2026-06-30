import { Injectable, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmOptions } from '@shared/ui/confirm-dialog/confirm-dialog.component';

export type { ConfirmOptions };

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(Dialog);

  /** Resolves true/false only — the caller performs the action and owns its own busy-state/toast. */
  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<boolean, ConfirmOptions>(ConfirmDialogComponent, {
      data: options,
      backdropClass: 'app-modal-backdrop',
      ariaLabelledBy: 'confirm-dialog-title',
    });
    const result = await firstValueFrom(ref.closed);
    return result ?? false;
  }
}
