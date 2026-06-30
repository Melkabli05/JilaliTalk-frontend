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
    .mic-btn {
      width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-lg); background: var(--color-card); border: 1px solid transparent; cursor: pointer;
      color: var(--color-text-muted);
      transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
      flex-shrink: 0; position: relative;
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

    @media (prefers-reduced-motion: reduce) {
      .mic-btn.speaking::after { animation: none; opacity: 0.9; }
      .mic-btn:active { transform: none; }
    }

    @media (max-width: 699px) {
      .mic-btn { width: 32px; height: 32px; }
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
