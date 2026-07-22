import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LucideSend, LucidePlus, LucideX, LucideImage, LucideUserPlus } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import type { IntroductionPayload } from '@core/realtime/dm-send-payload.model';

/**
 * 'gift' | 'voice_room' | 'live_link' stay in the union — the store/transport/backend
 * support all six DM kinds end to end — but are hidden from the attach menu below for now
 * (product decision: ship image + profile-share first). Re-adding them to the UI later is
 * just uncommenting the two composer-attach-item buttons; no other wiring changes needed.
 */
export type ComposerAction = 'shareProfile' | 'image' | 'gift' | 'voice_room' | 'live_link';

@Component({
  selector: 'app-chat-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, TooltipDirective, LucideSend, LucidePlus, LucideX, LucideImage, LucideUserPlus],
  host: { class: 'flex flex-col shrink-0' },
  template: `
    @if (stagedIntroduction(); as intro) {
      <div class="flex items-center gap-2 py-1.5 px-2.5 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-[10px] mb-2">
        <app-avatar [src]="intro.headUrl ?? ''" [initials]="intro.nickname.slice(0, 2)" [alt]="intro.nickname" size="xs" />
        <span class="flex flex-col flex-1">
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">Sharing</span>
          <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ intro.nickname }}</span>
        </span>
        <button
          type="button"
          class="w-8 h-8 max-md:w-11 max-md:h-11 inline-flex items-center justify-center bg-transparent border-0
                 text-neutral-500 dark:text-neutral-400 rounded-full cursor-pointer {{ TOUCH }} shrink-0
                 transition-colors duration-150
                 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          (click)="removeStaged.emit()"
          [attr.aria-label]="'Remove shared profile of ' + intro.nickname"
        >
          <svg aria-hidden="true" lucideX [size]="14"></svg>
        </button>
      </div>
    }
    <form
      class="flex items-end gap-1.5 py-2 px-2.5 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
      (submit)="$event.preventDefault(); send.emit()"
    >
      @if (attachMenuOpen()) {
        <div class="fixed inset-0 z-[9] bg-transparent" (click)="closeAttachMenu()"></div>
      }
      <div class="relative">
        <button
          type="button"
          class="w-9 h-9 max-md:w-11 max-md:h-11 shrink-0 inline-flex items-center justify-center rounded-full border-0
                 cursor-pointer bg-transparent text-blue-600 dark:text-blue-300 {{ TOUCH }}
                 transition-[transform,background-color,box-shadow] duration-150
                 hover:bg-neutral-100 dark:hover:bg-neutral-800
                 active:scale-90 motion-reduce:active:scale-100
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          (click)="toggleAttachMenu()"
          [attr.aria-label]="attachMenuOpen() ? 'Close attach menu' : 'Attach a photo or share a profile'"
          [attr.aria-expanded]="attachMenuOpen()"
          [appTooltip]="attachMenuOpen() ? 'Close' : 'Attach'"
          tooltipPosition="top"
        >
          <svg aria-hidden="true" lucidePlus [size]="18"></svg>
        </button>
        @if (attachMenuOpen()) {
          <div
            class="absolute bottom-[calc(100%+6px)] left-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700
                   rounded-md shadow-md p-1 min-w-[160px] flex flex-col z-10
                   animate-[composerMenuIn_140ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none"
            role="menu"
          >
            <button
              type="button"
              class="flex items-center gap-2 py-2 px-2.5 bg-transparent border-0 text-neutral-900 dark:text-neutral-100
                     font-[inherit] text-sm text-start cursor-pointer rounded-sm {{ TOUCH }}
                     transition-colors duration-100
                     hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none
                     dark:hover:bg-neutral-800 dark:focus-visible:bg-neutral-800"
              role="menuitem"
              (click)="onAction('shareProfile')"
            >
              <svg aria-hidden="true" lucideUserPlus [size]="16"></svg>
              <span>Share profile</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-2 py-2 px-2.5 bg-transparent border-0 text-neutral-900 dark:text-neutral-100
                     font-[inherit] text-sm text-start cursor-pointer rounded-sm {{ TOUCH }}
                     transition-colors duration-100
                     hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none
                     dark:hover:bg-neutral-800 dark:focus-visible:bg-neutral-800"
              role="menuitem"
              (click)="onAction('image')"
            >
              <svg aria-hidden="true" lucideImage [size]="16"></svg>
              <span>Photo</span>
            </button>
            <!-- Gift / Voice room / Live link hidden for now — see the ComposerAction doc
                 comment above for how to bring them back. -->
          </div>
        }
      </div>
      <textarea
        class="flex-1 min-h-9 max-h-[120px] resize-none py-2 px-2.5 border border-neutral-200 dark:border-neutral-700
               rounded-md bg-neutral-50 dark:bg-neutral-950 font-[inherit] text-[max(16px,0.875rem)] text-neutral-900 dark:text-neutral-100
               outline-none transition-[border-color,box-shadow] duration-150
               focus:border-blue-400 focus:shadow-[0_0_0_3px_rgb(59_130_246/14%)]"
        rows="1"
        autocomplete="off"
        autocapitalize="sentences"
        autocorrect="off"
        spellcheck="true"
        enterkeyhint="send"
        [placeholder]="stagedIntroduction() ? 'Add a note (optional)…' : 'Message…'"
        [value]="draft()"
        (input)="onInput($any($event.target).value)"
        (keydown)="onKeydown($event)"
        (blur)="blur.emit()"
        [attr.aria-label]="'Message to ' + (recipientName() || 'this conversation')"
      ></textarea>
      <button
        type="submit"
        class="w-9 h-9 max-md:w-11 max-md:h-11 shrink-0 inline-flex items-center justify-center rounded-full border-0
               cursor-pointer bg-blue-500 text-white {{ TOUCH }}
               shadow-[0_4px_12px_-4px_rgb(59_130_246/35%)] dark:shadow-[0_4px_12px_-4px_rgb(59_130_246/45%)]
               transition-[transform,background-color,box-shadow] duration-150
               not-disabled:active:scale-90 motion-reduce:active:scale-100
               disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        [disabled]="!canSend()"
        [attr.aria-label]="canSend() ? (stagedIntroduction() ? 'Send introduction' : 'Send message') : 'Type a message or pick an attach option to send'"
        [title]="stagedIntroduction() ? 'Send introduction' : 'Send'"
      >
        <svg aria-hidden="true" lucideSend [size]="16"></svg>
      </button>
    </form>
  `,
  /** The attach-menu pop-in has no Tailwind built-in animation shape. */
  styles: [`
    @keyframes composerMenuIn {
      from { opacity: 0; transform: translateY(4px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
  `],
})
export class ChatComposerComponent {
  protected readonly TOUCH = '[touch-action:manipulation] [-webkit-tap-highlight-color:transparent]';

  readonly draft = input<string>('');
  readonly stagedIntroduction = input<IntroductionPayload | null>(null);
  readonly canSend = input<boolean>(false);
  readonly recipientName = input<string>('');

  readonly draftChange = output<string>();
  readonly send = output<void>();
  readonly removeStaged = output<void>();
  readonly blur = output<void>();
  readonly action = output<ComposerAction>();

  private readonly _attachMenuOpen = signal(false);
  protected readonly attachMenuOpen = this._attachMenuOpen.asReadonly();

  protected toggleAttachMenu(): void {
    this._attachMenuOpen.update((v) => !v);
  }

  protected closeAttachMenu(): void {
    this._attachMenuOpen.set(false);
  }

  protected onAction(action: ComposerAction): void {
    this._attachMenuOpen.set(false);
    this.action.emit(action);
  }

  protected onInput(value: string): void {
    this.draftChange.emit(value);
  }

  protected onKeydown(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.key === 'Escape' && this.attachMenuOpen()) {
      this.closeAttachMenu();
      return;
    }
    if (ke.key !== 'Enter' || ke.shiftKey) return;
    ke.preventDefault();
    this.send.emit();
  }
}