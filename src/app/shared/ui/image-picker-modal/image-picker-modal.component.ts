import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { LucideImage, LucideImageOff, LucideLoader2 } from '@lucide/angular';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';

export interface ImagePickerResult {
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

type PreviewState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * A proper picker for the chat "Photo" send action — replaces a bare window.prompt() with
 * a URL field, live preview, and dimension auto-detection (the natural width/height the
 * browser reads off the loaded image), styled with this app's design tokens and the same
 * ModalComponent/DialogRef<T> pattern ConfirmDialogComponent uses.
 *
 * There is no image-upload endpoint in this app today — the backend's DmSendPayload
 * `image` kind takes a hosted URL, the same as the real HelloTalk client sends after its own
 * CDN upload completes. Offering a "choose from device" button here would be misleading
 * without a real upload pipeline behind it (a local file has no URL another device can
 * resolve), so this stays URL-first; a future upload feature can extend this modal rather
 * than replace it.
 */
@Component({
  selector: 'app-image-picker-modal',
  imports: [ModalComponent, ButtonComponent, A11yModule, LucideImage, LucideImageOff, LucideLoader2],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Send a photo">
      <label class="url-label" for="image-url-input">Image URL</label>
      <div class="url-row">
        <input
          id="image-url-input"
          type="url"
          inputmode="url"
          class="url-field"
          placeholder="https://example.com/photo.jpg"
          autocomplete="off"
          cdkFocusInitial
          [value]="url()"
          (input)="onUrlInput($any($event.target).value)"
        />
      </div>

      <div class="preview" [class.preview--empty]="state() !== 'loaded'">
        @if (state() === 'idle') {
          <svg aria-hidden="true" lucideImage [size]="28" class="preview-icon"></svg>
          <span class="preview-hint">Paste a link to preview it here</span>
        }
        @if (state() === 'loading') {
          <svg aria-hidden="true" lucideLoader2 [size]="24" class="preview-spinner"></svg>
        }
        @if (state() === 'error') {
          <svg aria-hidden="true" lucideImageOff [size]="28" class="preview-icon preview-icon--error"></svg>
          <span class="preview-hint preview-hint--error">Couldn't load that image</span>
        }
        <!-- Always rendered once loading has started (not just once loaded) — its own
             (load)/(error) events are what drive the loading -> loaded/error transition
             above, so it can't be gated behind the state it's responsible for reaching. -->
        @if (state() === 'loading' || state() === 'loaded') {
          <img
            class="preview-img"
            [class.preview-img--hidden]="state() !== 'loaded'"
            [src]="trimmedUrl()"
            alt="Preview"
            (load)="onImageLoad($event)"
            (error)="onImageError()"
          />
        }
      </div>

      <div class="footer">
        <app-button type="button" variant="ghost" size="md" (click)="onCancel()">Cancel</app-button>
        <app-button type="button" variant="primary" size="md" [disabled]="state() !== 'loaded'" (click)="onSend()">
          Send
        </app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    :host { display: block; width: 360px; max-width: calc(100vw - var(--space-6)); }
    .url-label { display: block; font-size: var(--text-xs); font-weight: var(--font-medium); color: var(--color-text-muted); margin-bottom: var(--space-1); }
    .url-row { margin-bottom: var(--space-3); }
    .url-field {
      width: 100%; box-sizing: border-box;
      padding: 8px 10px; border: 1px solid var(--color-border);
      border-radius: var(--radius-md); background: var(--color-bg);
      font: inherit; font-size: max(16px, var(--text-sm)); color: var(--color-text);
      outline: none;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .url-field:focus { border-color: var(--color-primary-400); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 14%, transparent); }
    .preview {
      position: relative;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2);
      min-height: 180px; border-radius: var(--radius-lg);
      overflow: hidden;
      margin-bottom: var(--space-4);
    }
    .preview--empty { background: var(--color-neutral-100); }
    :host-context(.dark) .preview--empty { background: var(--color-neutral-800); }
    .preview-icon { color: var(--color-text-muted); }
    .preview-icon--error { color: var(--color-error-500); }
    .preview-hint { font-size: var(--text-xs); color: var(--color-text-muted); }
    .preview-hint--error { color: var(--color-error-500); }
    .preview-spinner { color: var(--color-primary-500); animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .preview-img { width: 100%; max-height: 260px; object-fit: contain; display: block; }
    .preview-img--hidden { position: absolute; opacity: 0; pointer-events: none; max-height: none; height: 1px; }
    .footer {
      display: flex; justify-content: flex-end; align-items: center; gap: var(--space-2);
      padding-top: var(--space-4); border-top: 1px solid var(--color-border);
    }
    @media (prefers-reduced-motion: reduce) {
      .preview-spinner { animation: none; }
    }
  `],
})
export class ImagePickerModalComponent {
  private readonly ref = inject(DialogRef<ImagePickerResult | null>);

  protected readonly url = signal('');
  protected readonly trimmedUrl = computed(() => this.url().trim());
  protected readonly state = signal<PreviewState>('idle');

  private naturalWidth: number | null = null;
  private naturalHeight: number | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected onUrlInput(value: string): void {
    this.url.set(value);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const trimmed = value.trim();
    if (!trimmed) {
      this.state.set('idle');
      return;
    }
    this.debounceTimer = setTimeout(() => {
      if (this.url().trim() === trimmed) this.state.set('loading');
    }, 300);
  }

  protected onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.naturalWidth = img.naturalWidth || null;
    this.naturalHeight = img.naturalHeight || null;
    this.state.set('loaded');
  }

  protected onImageError(): void {
    this.naturalWidth = null;
    this.naturalHeight = null;
    this.state.set('error');
  }

  protected onCancel(): void {
    this.ref.close(null);
  }

  protected onSend(): void {
    const trimmed = this.trimmedUrl();
    if (!trimmed || this.state() !== 'loaded') return;
    this.ref.close({ url: trimmed, width: this.naturalWidth, height: this.naturalHeight });
  }
}
