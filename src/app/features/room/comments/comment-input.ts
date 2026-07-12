import { Component, ChangeDetectionStrategy, computed, inject, input, output, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { LucideSend, LucideSmile, LucideX, LucideCornerUpLeft } from '@lucide/angular';
import { KeyboardInsetService } from '@core/services/keyboard-inset.service';
import { StarterCommentsComponent } from './starter-comments';

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
  host: {
    '[style.bottom.px]': 'hostBottomPx()',
    '[style.--kb-inset.px]': 'hostBottomPx()',
  },
  imports: [LucideSend, LucideSmile, LucideX, LucideCornerUpLeft, StarterCommentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showStarterComments()) {
      <app-starter-comments
        [langId]="langId()"
        [disabled]="disabled()"
        (pick)="onStarterPick($event)"
      />
    }

    @if (replyTo(); as target) {
      <div class="reply-preview">
        <svg aria-hidden="true" lucideCornerUpLeft [size]="12" class="reply-icon" />
        <span class="reply-text">
          Replying to <strong>{{ target.nickname }}</strong>: {{ target.text }}
        </span>
        <button type="button" class="reply-cancel" (click)="cancelReply.emit()" [disabled]="disabled()" aria-label="Cancel reply">
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
        [disabled]="disabled()"
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
        enterkeyhint="send"
        autocapitalize="sentences"
        autocorrect="on"
        [disabled]="disabled()"
        [placeholder]="placeholder()"
        (keydown.enter)="onSend($event)"
        (input)="onInput($event)"
        #inputEl
      />
      <button class="send-btn" (click)="onSendFromBtn(inputEl)" aria-label="Send comment" [disabled]="disabled()">
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
      padding-bottom: calc(var(--space-2) + var(--shell-inset-bottom));
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
      flex: 1; padding: var(--space-2) var(--space-3); border-radius: var(--radius-full);
      border: 1px solid var(--ci-border); background: var(--ci-input);
      font-size: var(--text-sm); color: var(--ci-text); outline: none;
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
        /* WCAG 2.5.5 AAA: 44×44px minimum for primary interactive controls */
        width: 44px;
        height: 44px;
      }

      .reply-cancel {
        width: 44px;
        height: 44px;
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
        /* Cap by whichever is smaller: the library's nominal cap (400px) or the
           space actually visible above the keyboard (visible viewport minus the
           pinned input-bar height). Without the visible-viewport cap, a picker
           400px tall extends above the visible area when the keyboard is open and
           no overflow handling can save it. */
        max-height: min(
          400px,
          calc(100svh - var(--mobile-input-height) - var(--kb-inset, 0px) - 56px)
        );
        overflow-y: auto;
      }

      emoji-picker {
        --num-columns: 6;
        width: 100% !important;
        height: 100% !important;
        max-height: min(
          400px,
          calc(100svh - var(--mobile-input-height) - var(--kb-inset, 0px) - 56px)
        ) !important;
      }

      /* Pin the input to the bottom of the viewport for the immersive mobile
         room (where the global bottom-nav is hidden, so this slot is
         free). The room-header at the top is pinned by room-page.ts using
         the same shell-inset contract. z-shell-sidenav (40) sits above
         z-shell-header (30) and below every room-header overlay
         (.info-backdrop @ z-overlay=50, .overflow-panel @ z-toast+1=101,
         .expanded-comments @ z-modal=70), so all of those still cover the
         input when they open. */
      :host {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: var(--z-shell-sidenav);
        isolation: auto;
      }
    }
  `],
})
export class CommentInputComponent {
  private readonly keyboardInset = inject(KeyboardInsetService);

  /**
   * Host-bottom offset that lifts the bar above an open soft keyboard. The bar
   * is `position: fixed; bottom: 0` inside the mobile media query; setting
   * `style.bottom.px` to the keyboard inset shifts the bar up so its bottom edge
   * sits at the top of the keyboard instead of being covered by it. iOS Safari
   * reports `window.visualViewport.height + offsetTop` shrinking while the
   * keyboard is open; this binding consumes that signal.
   */
  protected readonly hostBottomPx = computed(() => this.keyboardInset.keyboardInsetPx());

  readonly replyTo = input<ReplyTarget | null>(null);
  readonly disabled = input(false);
  readonly langId = input<number>(1);
  readonly showStarterComments = input(false);
  readonly send = output<SendEvent>();
  readonly cancelReply = output<void>();
  readonly typing = output<void>();

  readonly showEmojiPicker = signal(false);
  /** Placeholder for the input — swaps to a "you're invisible" hint when disabled. */
  protected readonly placeholder = computed(() => {
    if (this.disabled()) return "You're invisible — rejoin visibly to comment";
    const reply = this.replyTo();
    return reply ? `Reply to ${reply.nickname}…` : 'Say something...';
  });
  private inputRef: HTMLInputElement | null = null;
  private lastTypingEmit = 0;
  private static readonly TYPING_THROTTLE_MS = 800;

  async toggleEmojiPicker(): Promise<void> {
    if (this.disabled()) return;
    if (!this.showEmojiPicker()) {
      await import('emoji-picker-element');
    }
    this.showEmojiPicker.update((v) => !v);
  }

  onEmojiClick(event: Event): void {
    if (this.disabled()) return;
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
    if (this.disabled()) return;
    const input = event.target as HTMLInputElement;
    this.inputRef = input;
    this.submit(input);
  }

  onInput(event: Event): void {
    if (this.disabled()) return;
    const input = event.target as HTMLInputElement;
    this.inputRef = input;
    if (!input.value) return;
    const now = Date.now();
    if (now - this.lastTypingEmit < CommentInputComponent.TYPING_THROTTLE_MS) return;
    this.lastTypingEmit = now;
    this.typing.emit();
  }

  onSendFromBtn(input: HTMLInputElement): void {
    if (this.disabled()) return;
    this.inputRef = input;
    this.submit(input);
  }

  onStarterPick(phrase: string): void {
    if (this.disabled()) return;
    this.send.emit({ text: phrase, replyInfo: null });
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
