import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';

export interface AvatarPreviewDialogData {
  readonly src: string;
  readonly alt: string;
}

@Component({
  selector: 'app-avatar-preview-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="avatar-preview-backdrop" (click)="close()">
      <button type="button" class="avatar-preview-close" aria-label="Close preview" (click)="close()">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <img
        class="avatar-preview-img"
        [src]="data.src"
        [alt]="data.alt"
        (click)="$event.stopPropagation()"
      />
    </div>
  `,
  styles: [`
    .avatar-preview-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-6) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
      padding-top: max(var(--space-6), env(safe-area-inset-top));
      background: transparent;
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      cursor: zoom-out;
      animation: avatar-preview-fade-in 0.15s ease-out;
    }
    @keyframes avatar-preview-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .avatar-preview-img {
      max-width: min(94vw, 720px);
      max-height: 90vh;
      width: auto;
      height: auto;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-modal);
      cursor: default;
      object-fit: contain;
    }
    .avatar-preview-close {
      position: absolute;
      top: max(var(--space-4), env(safe-area-inset-top));
      right: var(--space-4);
      width: var(--touch-target-min);
      height: var(--touch-target-min);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-full);
      border: none;
      background: color-mix(in srgb, var(--color-black) 40%, transparent);
      color: white;
      cursor: pointer;
    }
    .avatar-preview-close svg {
      width: 18px;
      height: 18px;
    }
    .avatar-preview-close:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    @media (prefers-reduced-motion: reduce) {
      .avatar-preview-backdrop { animation: none; }
    }
  `],
})
export class AvatarPreviewDialogComponent {
  protected readonly data = inject<AvatarPreviewDialogData>(DIALOG_DATA);
  private readonly ref = inject(DialogRef<void>);

  close(): void {
    this.ref.close();
  }
}
