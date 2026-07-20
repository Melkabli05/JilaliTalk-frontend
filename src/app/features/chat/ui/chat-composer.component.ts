import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LucideSend, LucidePlus, LucideX, LucideImage, LucideGift, LucideRadio, LucideVideo, LucideUserPlus } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import type { IntroductionPayload } from '@core/realtime/dm-send-payload.model';

export type ComposerAction = 'shareProfile' | 'image' | 'gift' | 'voice_room' | 'live_link';

@Component({
  selector: 'app-chat-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, TooltipDirective, LucideSend, LucidePlus, LucideX, LucideImage, LucideGift, LucideRadio, LucideVideo, LucideUserPlus],
  template: `
    @if (stagedIntroduction(); as intro) {
      <div class="composer-staged">
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
      <div class="composer-attach-group">
        <button
          type="button"
          class="composer-attach"
          (click)="toggleAttachMenu()"
          [attr.aria-label]="attachMenuOpen() ? 'Close attach menu' : 'Attach photo, gift, voice room, live room, or share a profile'"
          [attr.aria-expanded]="attachMenuOpen()"
          [appTooltip]="attachMenuOpen() ? 'Close' : 'Attach'"
          tooltipPosition="top"
        >
          <svg aria-hidden="true" lucidePlus [size]="18"></svg>
        </button>
        @if (attachMenuOpen()) {
          <div class="composer-attach-menu" role="menu">
            <button type="button" class="composer-attach-item" role="menuitem" (click)="onAction('shareProfile')">
              <svg aria-hidden="true" lucideUserPlus [size]="16"></svg>
              <span>Share profile</span>
            </button>
            <button type="button" class="composer-attach-item" role="menuitem" (click)="onAction('image')">
              <svg aria-hidden="true" lucideImage [size]="16"></svg>
              <span>Photo</span>
            </button>
            <button type="button" class="composer-attach-item" role="menuitem" (click)="onAction('gift')">
              <svg aria-hidden="true" lucideGift [size]="16"></svg>
              <span>Gift</span>
            </button>
            <button type="button" class="composer-attach-item" role="menuitem" (click)="onAction('voice_room')">
              <svg aria-hidden="true" lucideRadio [size]="16"></svg>
              <span>Voice room</span>
            </button>
            <button type="button" class="composer-attach-item" role="menuitem" (click)="onAction('live_link')">
              <svg aria-hidden="true" lucideVideo [size]="16"></svg>
              <span>Live link</span>
            </button>
          </div>
        }
      </div>
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
        [attr.aria-label]="canSend() ? (stagedIntroduction() ? 'Send introduction' : 'Send message') : 'Type a message or pick an attach option to send'"
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
      width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
      background: transparent; border: 0; color: var(--color-text-muted);
      border-radius: var(--radius-full); cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      flex-shrink: 0;
      transition: background-color 150ms ease, color 150ms ease;
    }
    .composer-staged-remove:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .composer-staged-remove:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    @media (max-width: 767.98px) {
      .composer-staged-remove { width: 44px; height: 44px; }
    }
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
      color: var(--color-primary-text);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: transform 100ms ease, background-color 150ms ease, box-shadow 150ms ease;
    }
    .composer-attach:focus-visible, .composer-send:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .composer-attach:active, .composer-send:not(:disabled):active { transform: scale(0.9); }
    .composer-send { background: var(--color-primary-500); color: var(--color-on-color); box-shadow: var(--shadow-primary-sm); }
    .composer-send:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
    .composer-attach:hover { background: var(--color-neutral-100); }
    .composer-attach-group { position: relative; }
    .composer-attach-menu {
      position: absolute; bottom: calc(100% + 6px); left: 0;
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      padding: 4px; min-width: 160px;
      display: flex; flex-direction: column;
      animation: composerMenuIn 140ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      z-index: 10;
    }
    @keyframes composerMenuIn {
      from { opacity: 0; transform: translateY(4px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .composer-attach-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; background: transparent; border: 0;
      color: var(--color-text); font-family: inherit; font-size: var(--text-sm);
      text-align: start; cursor: pointer; border-radius: var(--radius-sm);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background-color 120ms ease;
    }
    .composer-attach-item:hover, .composer-attach-item:focus-visible {
      background: var(--color-neutral-100);
      outline: none;
    }
    :host-context(.dark) .composer-attach-item:hover, :host-context(.dark) .composer-attach-item:focus-visible {
      background: var(--color-neutral-800);
    }
    .composer-field {
      flex: 1; min-height: 36px; max-height: 120px; resize: none;
      padding: 8px 10px; border: 1px solid var(--color-border);
      border-radius: var(--radius-md); background: var(--color-bg);
      font-family: inherit; font-size: max(16px, var(--text-sm)); color: var(--color-text);
      outline: none;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .composer-field:focus { border-color: var(--color-primary-400); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 14%, transparent); }
    @media (max-width: 767.98px) {
      .composer-attach, .composer-send { width: 44px; height: 44px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .composer-attach, .composer-send { transition: none; }
      .composer-attach:active, .composer-send:active { transform: none; }
    }
  `],
})
export class ChatComposerComponent {
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

  protected onAction(action: ComposerAction): void {
    this._attachMenuOpen.set(false);
    this.action.emit(action);
  }

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