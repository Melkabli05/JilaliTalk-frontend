import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideSend, LucideUserPlus, LucideX } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import type { IntroductionPayload } from '@core/realtime/ht-protocol/packet-framer.util';

@Component({
  selector: 'app-chat-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, TooltipDirective, LucideSend, LucideUserPlus, LucideX],
  template: `
    @if (stagedIntroduction(); as intro) {
      <div class="composer-staged" role="status">
        <app-avatar [src]="intro.headUrl ?? ''" [initials]="intro.nickname.slice(0, 2)" [alt]="intro.nickname" size="xs" />
        <span class="composer-staged-meta">
          <span class="composer-staged-label">Sharing</span>
          <span class="composer-staged-name">{{ intro.nickname }}</span>
        </span>
        <button
          type="button"
          class="composer-staged-remove"
          (click)="removeStaged.emit()"
          [attr.aria-label]="'Remove shared profile of ' + intro.nickname"
        >
          <svg aria-hidden="true" lucideX [size]="14"></svg>
        </button>
      </div>
    }
    <form class="composer" (submit)="$event.preventDefault(); send.emit()">
      <button
        type="button"
        class="composer-attach"
        (click)="toggleAttach.emit()"
        [attr.aria-label]="attachOpen() ? 'Close share profile' : 'Share a profile'"
        [attr.aria-expanded]="attachOpen()"
        [appTooltip]="attachOpen() ? 'Close share profile' : 'Share a profile'"
        tooltipPosition="top"
      >
        <svg aria-hidden="true" lucideUserPlus [size]="16"></svg>
      </button>
      <textarea
        class="composer-field"
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
        class="composer-send"
        [disabled]="!canSend()"
        [attr.aria-label]="canSend() ? (stagedIntroduction() ? 'Send introduction' : 'Send message') : 'Type a message or attach a profile to send'"
        [title]="stagedIntroduction() ? 'Send introduction' : 'Send'"
      >
        <svg aria-hidden="true" lucideSend [size]="16"></svg>
      </button>
    </form>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex-shrink: 0; }
    .composer-staged {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; background: var(--color-primary-50);
      border: 1px solid var(--color-primary-200);
      border-radius: 10px; margin-bottom: 8px;
    }
    .composer-staged-meta { display: flex; flex-direction: column; flex: 1; }
    .composer-staged-label { font-size: var(--text-2xs); color: var(--color-text-muted); }
    .composer-staged-name { font-size: var(--text-sm); font-weight: var(--font-medium); }
    .composer-staged-remove {
      width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
      background: transparent; border: 0; color: var(--color-text-muted);
      border-radius: var(--radius-full); cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .composer-staged-remove:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .composer-staged-remove:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .composer {
      display: flex; align-items: flex-end; gap: 6px;
      padding: 8px 10px;
      border-top: 1px solid var(--color-border);
      background: var(--color-card);
    }
    .composer-attach, .composer-send {
      width: 36px; height: 36px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 0; cursor: pointer; background: transparent;
      color: var(--color-primary-600);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .composer-attach:focus-visible, .composer-send:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .composer-send { background: var(--color-primary-500); color: var(--color-on-color); }
    .composer-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .composer-attach:hover { background: var(--color-neutral-100); }
    .composer-field {
      flex: 1; min-height: 36px; max-height: 120px; resize: none;
      padding: 8px 10px; border: 1px solid var(--color-border);
      border-radius: var(--radius-md); background: var(--color-bg);
      font-family: inherit; font-size: max(16px, var(--text-sm)); color: var(--color-text);
      outline: none;
    }
    .composer-field:focus { border-color: var(--color-primary-400); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 14%, transparent); }
    @media (max-width: 767.98px) {
      .composer-attach, .composer-send { width: 44px; height: 44px; }
    }
  `],
})
export class ChatComposerComponent {
  readonly draft = input<string>('');
  readonly stagedIntroduction = input<IntroductionPayload | null>(null);
  readonly attachOpen = input<boolean>(false);
  readonly canSend = input<boolean>(false);
  readonly recipientName = input<string>('');

  readonly draftChange = output<string>();
  readonly send = output<void>();
  readonly toggleAttach = output<void>();
  readonly removeStaged = output<void>();
  readonly blur = output<void>();

  protected onInput(value: string): void {
    this.draftChange.emit(value);
  }

  protected onKeydown(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.key !== 'Enter' || ke.shiftKey) return;
    ke.preventDefault();
    this.send.emit();
  }
}