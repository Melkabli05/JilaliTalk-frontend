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

      <textarea
        #inputEl
        class="comment-input"
        rows="1"
        enterkeyhint="send"
        autocapitalize="sentences"
        autocorrect="on"
        [placeholder]="replyTo() ? 'Reply to ' + replyTo()!.nickname + '…' : 'Say something...'"
        (keydown.enter)="onEnter($event)"
        (input)="onInput($event)"
      ></textarea>
      <button class="send-btn" (click)="onSendFromBtn(inputEl)" aria-label="Send comment">
        <svg aria-hidden="true" lucideSend [size]="14"></svg>
      </button>
    </div>
  `,
  styles: [`
    /* Create a stacking context so the absolutely-positioned emoji picker
       can't escape the comment panel and clip behind the room header. */
    :host {
      display: block;
      flex-shrink: 0;
      position: relative;
      isolation: isolate;

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
      position: absolute; bottom: 100%; left: var(--space-3); z-index: 1;
      margin-bottom: var(--space-1);
    }
    emoji-picker {
      --background: var(--ci-bg);
      --border-color: var(--ci-border);
      --text-color: var(--ci-text);
      --secondary-text-color: var(--ci-muted);
    }
    .comment-input {
      flex: 1;
      min-height: 40px;
      max-height: 96px;       /* ~4 lines at 1.5 line-height — beyond this, the field scrolls internally */
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-full);
      border: 1px solid var(--ci-border);
      background: var(--ci-input);
      font: inherit;
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      color: var(--ci-text);
      outline: none;
      resize: none;
      overflow-y: auto;
      field-sizing: content;
    }
    .comment-input:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .comment-input::placeholder { color: var(--ci-muted); }
    .send-btn {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--color-primary-500); color: var(--color-on-color); border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .send-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    /* Mobile: 16px stops iOS Safari auto-zooming the page on focus (it zooms
       whenever a focused input's computed font-size is under 16px) — this is
       the most-typed-in field in the room, so it matters more here than
       anywhere else. Larger buttons are closer to a comfortably tappable
       target than the desktop 32px/18px sizes. */
    @media (max-width: 1023.98px) {
      .comment-input {
        font-size: var(--text-base);
      }

      .emoji-btn,
      .send-btn {
        width: 40px;
        height: 40px;
      }

      .reply-cancel {
        width: 32px;
        height: 32px;
      }

      /* The emoji-picker-element web component has no viewport awareness of
         its own (fixed 400px height, ~300px min-content width) — inset it
         from both edges so it can never render wider than the screen, and
         cap its height so it can't extend above the visible viewport when
         there isn't 400px of room above the input. --num-columns is one of
         the library's documented custom properties, so it reliably crosses
         the shadow-DOM boundary; width/height do not by default; the
         !important pair over-anchoring is the pragmatic way to beat the
         component's own internal :host{width:min-content;height:400px}. */
      .emoji-picker-container {
        left: var(--space-2);
        right: var(--space-2);
        max-height: min(400px, 60vh);
      }

      emoji-picker {
        --num-columns: 6;
        width: 100% !important;
        height: 100% !important;
        max-height: min(400px, 60vh) !important;
      }
    }
  `],
})
export class CommentInputComponent {
  readonly replyTo = input<ReplyTarget | null>(null);
  readonly send = output<SendEvent>();
  readonly cancelReply = output<void>();
  readonly typing = output<void>();

  readonly showEmojiPicker = signal(false);
  private inputRef: HTMLTextAreaElement | null = null;
  private lastTypingEmit = 0;
  private static readonly TYPING_THROTTLE_MS = 800;
  private resizeObserver: ResizeObserver | null = null;

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
      this.autoResize(input);
    }
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    // Shift+Enter inserts a newline; Enter during IME composition also inserts a newline.
    if (keyboardEvent.shiftKey || keyboardEvent.isComposing || keyboardEvent.keyCode === 229) {
      return; // let the textarea handle the newline natively
    }
    keyboardEvent.preventDefault();
    const input = event.target as HTMLTextAreaElement;
    this.inputRef = input;
    this.submit(input);
  }

  onInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.inputRef = input;
    this.autoResize(input);
    if (!input.value) return;
    const now = Date.now();
    if (now - this.lastTypingEmit < CommentInputComponent.TYPING_THROTTLE_MS) return;
    this.lastTypingEmit = now;
    this.typing.emit();
  }

  onSendFromBtn(input: HTMLTextAreaElement): void {
    this.inputRef = input;
    this.submit(input);
  }

  /** Resize the textarea to fit its content. Uses native `field-sizing: content`
   *  when supported; ResizeObserver handles legacy browsers. The 96px max-height
   *  in CSS caps the field at ~4 lines; beyond that the textarea becomes
   *  internally scrollable. */
  private autoResize(textarea: HTMLTextAreaElement): void {
    // Reset to recompute (scrollHeight would otherwise be stale).
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }

  private submit(input: HTMLTextAreaElement): void {
    const text = input.value.trim();
    if (text) {
      this.send.emit({ text, replyInfo: this.replyTo() ?? null });
      input.value = '';
    }
    this.showEmojiPicker.set(false);
    this.autoResize(input);
  }
}
