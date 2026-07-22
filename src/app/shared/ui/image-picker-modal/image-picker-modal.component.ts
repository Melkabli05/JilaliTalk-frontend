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
  host: { class: 'block w-90 max-w-[calc(100vw-1.5rem)]' },
  template: `
    <app-modal title="Send a photo">
      <label class="block text-xs font-medium text-neutral-500 mb-1" for="image-url-input">Image URL</label>
      <div class="mb-3">
        <input
          id="image-url-input"
          type="url"
          inputmode="url"
          class="w-full box-border py-2 px-2.5 border border-neutral-200 dark:border-neutral-700 rounded-md
                 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100
                 font-[inherit] text-[max(16px,0.875rem)] outline-none
                 transition-[border-color,box-shadow] duration-150
                 focus:border-blue-400 focus:shadow-[0_0_0_3px_rgb(59_130_246/14%)]"
          placeholder="https://example.com/photo.jpg"
          autocomplete="off"
          cdkFocusInitial
          [value]="url()"
          (input)="onUrlInput($any($event.target).value)"
        />
      </div>

      <div
        class="relative flex flex-col items-center justify-center gap-2 min-h-[180px] rounded-lg overflow-hidden mb-4"
        [class]="state() !== 'loaded' ? 'bg-neutral-100 dark:bg-neutral-800' : ''"
      >
        @if (state() === 'idle') {
          <svg aria-hidden="true" lucideImage [size]="28" class="text-neutral-500"></svg>
          <span class="text-xs text-neutral-500">Paste a link to preview it here</span>
        }
        @if (state() === 'loading') {
          <svg aria-hidden="true" lucideLoader2 [size]="24" class="text-blue-500 animate-spin motion-reduce:animate-none"></svg>
        }
        @if (state() === 'error') {
          <svg aria-hidden="true" lucideImageOff [size]="28" class="text-red-500"></svg>
          <span class="text-xs text-red-500">Couldn't load that image</span>
        }
        <!-- Always rendered once loading has started (not just once loaded) — its own
             (load)/(error) events are what drive the loading -> loaded/error transition
             above, so it can't be gated behind the state it's responsible for reaching. -->
        @if (state() === 'loading' || state() === 'loaded') {
          <img
            class="w-full max-h-[260px] object-contain block"
            [class]="state() !== 'loaded' ? 'absolute opacity-0 pointer-events-none !max-h-none h-px' : ''"
            [src]="trimmedUrl()"
            alt="Preview"
            (load)="onImageLoad($event)"
            (error)="onImageError()"
          />
        }
      </div>

      <div class="flex justify-end items-center gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <app-button type="button" variant="ghost" size="md" (click)="onCancel()">Cancel</app-button>
        <app-button type="button" variant="primary" size="md" [disabled]="state() !== 'loaded'" (click)="onSend()">
          Send
        </app-button>
      </div>
    </app-modal>
  `,
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
