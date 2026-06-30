import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { ProfileStore } from '../../store/profile.store';
import { DialogRef } from '@angular/cdk/dialog';

@Component({
  selector: 'app-edit-profile-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField],
  template: `
    <div class="sheet">
      <h3 class="sheet-title">Edit Profile</h3>

      <label class="field">
        <span>Birthday</span>
        <input type="date" [formField]="editForm.birthday" class="input" />
      </label>

      <label class="field">
        <span>Nationality</span>
        <select [formField]="editForm.nationality" class="input">
          <option value="">Select country</option>
          <option value="MA">Morocco</option>
          <option value="FR">France</option>
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="DE">Germany</option>
          <option value="ES">Spain</option>
          <option value="IT">Italy</option>
          <option value="JP">Japan</option>
          <option value="CN">China</option>
          <option value="BR">Brazil</option>
        </select>
      </label>

      @if (saveError()) {
        <p class="error">{{ saveError() }}</p>
      }

      <div class="actions">
        <button type="button" class="btn-cancel" (click)="dialogRef.close()">Cancel</button>
        <button
          type="button"
          class="btn-save"
          (click)="onSave()"
          [disabled]="editForm().invalid() || saving()"
        >
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .sheet { padding: var(--space-6); min-width: 320px; display: flex; flex-direction: column; gap: var(--space-4); }
    .sheet-title { font-size: var(--text-lg); font-weight: 600; margin: 0; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field span { font-size: var(--text-sm); color: var(--color-text-muted); }
    .input { padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--text-sm); background: var(--color-card); color: var(--color-text); }
    .error { color: var(--color-danger); font-size: var(--text-xs); margin: 0; }
    .actions { display: flex; gap: var(--space-3); justify-content: flex-end; }
    .btn-cancel { padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: transparent; cursor: pointer; font-size: var(--text-sm); }
    .btn-save { padding: 8px 16px; border-radius: var(--radius-md); border: none; background: var(--color-primary-500); color: white; cursor: pointer; font-size: var(--text-sm); }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class EditProfileSheetComponent {
  private readonly store = inject(ProfileStore);
  readonly dialogRef = inject(DialogRef);

  private readonly _model = signal({ birthday: '', nationality: '' });

  readonly editForm = form(this._model, () => ({}));

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  async onSave(): Promise<void> {
    submit(this.editForm, async () => {
      this.saving.set(true);
      this.saveError.set(null);
      const birthday = this.editForm.birthday().value();
      const nationality = this.editForm.nationality().value();
      const data: { birthday?: string; nationality?: string } = {};
      if (birthday) data.birthday = birthday;
      if (nationality) data.nationality = nationality;
      const ok = await this.store.editProfile(data);
      this.saving.set(false);
      if (ok) {
        this.dialogRef.close(true);
      } else {
        this.saveError.set('Failed to update profile. Please try again.');
      }
    });
  }
}
