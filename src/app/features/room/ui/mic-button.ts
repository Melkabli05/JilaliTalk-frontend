import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { LucideMic, LucideMicOff } from '@lucide/angular';

@Component({
  selector: 'app-mic-button',

  imports: [LucideMic, LucideMicOff],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="mic-btn"
      type="button"
      [class.active]="isOn() && !disabled()"
      [class.danger]="!isOn() && !disabled()"
      [class.speaking]="isOn() && speaking()"
      [disabled]="busy() || disabled()"
      (click)="toggled.emit()"
      [attr.aria-label]="isOn() ? 'Mute microphone' : 'Unmute microphone'"
      [attr.aria-pressed]="isOn()"
    >
      @if (isOn()) {
        <svg aria-hidden="true" lucideMic [size]="16"></svg>
      } @else {
        <svg aria-hidden="true" lucideMicOff [size]="16"></svg>
      }
    </button>
  `,
  styles: [`
    /* Container queries: room-header decides the slot width; the mic
       shrinks on narrow slots via @container, not the viewport. */
    :host {
      display: inline-flex;
      container-type: inline-size;
      container-name: mic-button;
    }
    .mic-btn {
      width: var(--toolbar-btn-size);
      height: var(--toolbar-btn-size);
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-lg);
      background: var(--color-card);
      border: 1px solid transparent;
      cursor: pointer;
      color: var(--color-text-muted);
      transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
      flex-shrink: 0;
      position: relative;
      -webkit-user-select: none;
      user-select: none;
    }
    .mic-btn:hover { box-shadow: var(--shadow-sm); }
    .mic-btn:active { transform: scale(0.92); }
    .mic-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    .mic-btn.active { color: var(--color-accent-600); background: var(--color-accent-50); border-color: var(--color-accent-200); }
    .mic-btn.active:hover { background: var(--color-accent-100); }
    .mic-btn.danger { color: var(--color-warm-600); background: var(--color-warm-50); border-color: var(--color-warm-200); }
    .mic-btn.danger:hover { background: var(--color-warm-100); }
    .mic-btn:disabled { opacity: 0.55; cursor: default; }
    .mic-btn:disabled:hover { transform: none; box-shadow: none; }

    .mic-btn.speaking::after {
      content: '';
      position: absolute; inset: -3px;
      border-radius: var(--radius-lg);
      border: 2px solid var(--color-accent-400);
      animation: mic-pulse 1.2s ease-out infinite;
      pointer-events: none;
    }
    @keyframes mic-pulse {
      0% { opacity: 0.9; transform: scale(0.95); }
      100% { opacity: 0; transform: scale(1.25); }
    }

    :host-context(.dark) {
      .mic-btn.active {
        color: var(--color-accent-300);
        background: var(--color-accent-900);
        border-color: var(--color-accent-700);
      }
      .mic-btn.danger {
        color: var(--color-warm-300);
        background: var(--color-warm-900);
        border-color: var(--color-warm-700);
      }
    }

    @container mic-button (max-width: 699.98px) {
      .mic-btn {
        width: var(--toolbar-btn-size-sm);
        height: var(--toolbar-btn-size-sm);
      }
    }
  `]
})
export class MicButtonComponent {
  readonly isOn = input.required<boolean>();
  readonly speaking = input<boolean>(false);
  readonly busy = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  readonly toggled = output<void>();
}
