import { Component, ChangeDetectionStrategy, input, output, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { LucideSend, LucideSmile, LucideX, LucideCornerUpLeft } from '@lucide/angular';

export interface ReplyTarget {
  readonly msgId: string;
  readonly fromId: number;
  readonly nickname: string;
  readonly text: string;
}

export interface SendEvent {
  readonly text: string;
  readonly replyInfo?: ReplyTarget | null;
}

@Component({
  selector: 'app-comment-input',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [LucideSend, LucideSmile, LucideX, LucideCornerUpLeft],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (replyTo(); as target) {
      <div class="reply-preview">
        <svg aria-hidden="true" lucideCornerUpLeft [size]="12" class="reply-icon" />
        <span class="reply-text">
          Replying to <strong>{{ target.nickname }}</strong>: {{ target.text }}
        </span>
        <button type="button" class="reply-cancel" (click)="cancelReply.emit()" aria-label="Cancel reply">
          <svg aria-hidden="true" lucideX [size]="12" />
        </button>
      </div>
    }

    <div class="comment-input-wrapper">
      <button
        class="emoji-btn"
        (click)="toggleEmojiPicker()"
        aria-label="Open emoji picker"
        [class.active]="showEmojiPicker()"
      >
        <svg aria-hidden="true" lucideSmile [size]="16"></svg>
      </button>

      @if (showEmojiPicker()) {
        <div class="emoji-picker-container">
          <emoji-picker
            id="emoji-picker"
            (emoji-click)="onEmojiClick($event)"
          ></emoji-picker>
        </div>
      }

      <input
        class="comment-input"
        type="text"
        [placeholder]="replyTo() ? 'Reply to ' + replyTo()!.nickname + '…' : 'Say something...'"
        (keydown.enter)="onSend($event)"
        (input)="onInput($event)"
        #inputEl
      />
      <button class="send-btn" (click)="onSendFromBtn(inputEl)" aria-label="Send comment">
        <svg aria-hidden="true" lucideSend [size]="14"></svg>
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; flex-shrink: 0; position: relative; }

    /* ─── Design tokens ─── */
    :host {
      --ci-border:  var(--color-border);
      --ci-bg:      var(--color-card);
      --ci-input:   var(--color-neutral-50);
      --ci-text:    var(--color-text);
      --ci-muted:   var(--color-text-muted);
      --ci-btn-bg:  var(--color-neutral-100);
      --ci-btn-txt: var(--color-text);
    }
    :host-context(.dark) {
      --ci-border:  var(--color-neutral-700);
      --ci-bg:      var(--color-neutral-800);
      --ci-input:   var(--color-neutral-800);
      --ci-text:    var(--color-neutral-100);
      --ci-muted:   var(--color-neutral-500);
      --ci-btn-bg:  var(--color-neutral-700);
      --ci-btn-txt: var(--color-neutral-100);
    }

    .reply-preview {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-3);
      border-top: 1px solid var(--ci-border);
      background: var(--ci-input);
      font-size: var(--text-2xs);
      color: var(--ci-muted);
    }
    .reply-icon { flex-shrink: 0; color: var(--color-primary-500); }
    .reply-text {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .reply-text strong { color: var(--ci-text); font-weight: var(--font-semibold); }
    .reply-cancel {
      width: 18px; height: 18px; border-radius: var(--radius-full);
      display: flex; align-items: center; justify-content: center;
      background: none; border: none; cursor: pointer; flex-shrink: 0;
      color: var(--ci-muted);
    }
    .reply-cancel:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    .comment-input-wrapper {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-top: 1px solid var(--ci-border);
      background: var(--ci-bg);
    }
    .emoji-btn {
      width: 32px; height: 32px; border-radius: var(--radius-full); background: none; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: var(--ci-muted); flex-shrink: 0;
    }
    .emoji-btn.active { color: var(--ci-text); }
    .emoji-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .emoji-picker-container {
      position: absolute; bottom: 100%; left: var(--space-3); z-index: 100;
      margin-bottom: var(--space-1);
    }
    emoji-picker {
      --background: var(--ci-bg);
      --border-color: var(--ci-border);
      --text-color: var(--ci-text);
      --secondary-text-color: var(--ci-muted);
    }
    .comment-input {
      flex: 1; padding: var(--space-2) var(--space-3); border-radius: var(--radius-full);
      border: 1px solid var(--ci-border); background: var(--ci-input);
      font-size: var(--text-sm); color: var(--ci-text); outline: none;
    }
    .comment-input:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .comment-input::placeholder { color: var(--ci-muted); }
    .send-btn {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--color-primary-500); color: white; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .send-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
  `],
})
export class CommentInputComponent {
  readonly replyTo = input<ReplyTarget | null>(null);
  readonly send = output<SendEvent>();
  readonly cancelReply = output<void>();
  readonly typing = output<void>();

  readonly showEmojiPicker = signal(false);
  private inputRef: HTMLInputElement | null = null;
  private lastTypingEmit = 0;
  private static readonly TYPING_THROTTLE_MS = 800;

  async toggleEmojiPicker(): Promise<void> {
    if (!this.showEmojiPicker()) {
      await import('emoji-picker-element');
    }
    this.showEmojiPicker.update((v) => !v);
  }

  onEmojiClick(event: Event): void {
    const input = this.inputRef;
    if (!input) return;
    const customEvent = event as CustomEvent<{ emoji: { unicode: string } }>;
    const emoji = customEvent.detail?.emoji?.unicode;
    if (emoji) {
      input.value = (input.value || '') + emoji;
      input.focus();
    }
  }

  onSend(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.inputRef = input;
    this.submit(input);
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.inputRef = input;
    if (!input.value) return;
    const now = Date.now();
    if (now - this.lastTypingEmit < CommentInputComponent.TYPING_THROTTLE_MS) return;
    this.lastTypingEmit = now;
    this.typing.emit();
  }

  onSendFromBtn(input: HTMLInputElement): void {
    this.inputRef = input;
    this.submit(input);
  }

  private submit(input: HTMLInputElement): void {
    const text = input.value.trim();
    if (text) {
      this.send.emit({ text, replyInfo: this.replyTo() ?? null });
      input.value = '';
    }
    this.showEmojiPicker.set(false);
  }
}
