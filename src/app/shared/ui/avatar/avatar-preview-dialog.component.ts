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
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center
             bg-transparent backdrop-blur-xl backdrop-saturate-150
             cursor-zoom-out animate-[avatar-preview-fade-in_0.15s_ease-out]
             motion-reduce:animate-none
             px-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]
             pt-[max(1.5rem,env(safe-area-inset-top))]"
      (click)="close()"
    >
      <button
        type="button"
        class="absolute right-4 flex items-center justify-center size-11 rounded-full border-0
               bg-black/40 text-white cursor-pointer
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
               [&_svg]:w-[18px] [&_svg]:h-[18px]
               top-[max(1rem,env(safe-area-inset-top))]"
        aria-label="Close preview"
        (click)="close()"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <img
        class="max-w-[min(94vw,720px)] max-h-[90vh] w-auto h-auto rounded-lg shadow-2xl cursor-default object-contain"
        [src]="data.src"
        [alt]="data.alt"
        (click)="$event.stopPropagation()"
      />
    </div>
  `,
  styles: [`
    @keyframes avatar-preview-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
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
