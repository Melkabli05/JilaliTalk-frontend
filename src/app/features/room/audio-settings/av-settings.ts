import { Component, ChangeDetectionStrategy, inject, input, output } from '@angular/core';
import { LucideWaves } from '@lucide/angular';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import type { AudioNoiseSuppressionLevel } from '@core/realtime/agora-rtc.service';

const NOISE_LEVELS: { value: AudioNoiseSuppressionLevel; label: string; description: string }[] = [
  { value: 0, label: 'Off', description: 'No noise reduction' },
  { value: 1, label: 'Soft', description: 'Light noise reduction' },
  { value: 2, label: 'Medium', description: 'Balanced (recommended)' },
  { value: 3, label: 'AI', description: 'Aggressive AI-powered' },
];

@Component({
  selector: 'app-av-settings',

  imports: [LucideWaves],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.inline]': "variant() === 'inline'",
  },
  template: `
    <div class="dropdown-panel" role="menu">
      <div class="dropdown-header">
        <svg aria-hidden="true" lucideWaves [size]="14"></svg>
        <span>Noise Suppression</span>
      </div>

      <div class="dropdown-options">
        @for (level of noiseLevels; track level.value) {
          <button
            type="button"
            class="dropdown-option"
            [class.selected]="room.agora.noiseSuppressionLevel() === level.value"
            role="menuitemradio"
            [attr.aria-checked]="room.agora.noiseSuppressionLevel() === level.value"
            (click)="onLevelChange(level.value)"
          >
            <span class="option-content">
              <span class="option-label">{{ level.label }}</span>
              <span class="option-desc">{{ level.description }}</span>
            </span>
            @if (room.agora.noiseSuppressionLevel() === level.value) {
              <svg class="check-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            }
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: var(--z-overlay);
      display: block;

      --avs-bg:           var(--color-card);
      --avs-border:       var(--color-border);
      --avs-header-bg:    var(--color-neutral-50);
      --avs-header-fg:    var(--color-text-secondary);
      --avs-header-bd:    var(--color-border);
      --avs-text:         var(--color-text);
      --avs-muted:        var(--color-text-muted);
      --avs-hover-bg:     var(--color-neutral-100);
      --avs-selected-bg:  var(--color-primary-50);
      --avs-selected-bg-hover: var(--color-primary-100);
      --avs-selected-fg:  var(--color-primary-700);
      --avs-check-fg:     var(--color-primary-600);
    }
    /* "inline" variant — used inside the mobile overflow bottom-sheet (room-header.ts), which
       is itself position:fixed and anchored to the viewport bottom. The default dropdown
       positioning (position:absolute; top:calc(100% + 6px)) resolves against *that* box in
       that context, not the row the user clicked, and renders the whole panel below the
       viewport — invisible, looking like the click did nothing. Inline mode drops the
       self-positioning and just flows as a normal full-width block in the sheet instead. */
    :host.inline {
      position: static;
      top: auto;
      right: auto;
      z-index: auto;
      width: 100%;
      margin-top: var(--space-2);
    }
    :host.inline .dropdown-panel {
      width: 100%;
    }
    :host.inline .dropdown-panel::before {
      display: none;
    }

    :host-context(.dark) {
      --avs-bg:           var(--color-neutral-800);
      --avs-border:       var(--color-neutral-700);
      --avs-header-bg:    var(--color-neutral-700);
      --avs-header-fg:    var(--color-neutral-300);
      --avs-header-bd:    var(--color-neutral-700);
      --avs-text:         var(--color-neutral-100);
      --avs-muted:        var(--color-neutral-400);
      --avs-hover-bg:     var(--color-neutral-700);
      --avs-selected-bg:  color-mix(in srgb, var(--color-primary-900) 40%, transparent);
      --avs-selected-bg-hover: color-mix(in srgb, var(--color-primary-900) 60%, transparent);
      --avs-selected-fg:  var(--color-primary-300);
      --avs-check-fg:     var(--color-primary-400);
    }

    .dropdown-panel {
      width: 240px;
      background: var(--avs-bg);
      border: 1px solid var(--avs-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-elevation-2);
      overflow: hidden;
      animation: dropIn 0.15s ease-out;
    }

    @keyframes dropIn {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .dropdown-panel { animation: none; }
    }

    .dropdown-panel::before {
      content: '';
      position: absolute;
      top: -6px;
      right: 12px;
      width: 10px;
      height: 10px;
      background: var(--avs-bg);
      border-left: 1px solid var(--avs-border);
      border-top: 1px solid var(--avs-border);
      transform: rotate(45deg);
    }

    .dropdown-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--avs-header-fg);
      border-bottom: 1px solid var(--avs-header-bd);
      background: var(--avs-header-bg);
    }

    .dropdown-options {
      padding: var(--space-1);
    }

    .dropdown-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: var(--space-2) var(--space-3);
      border: none;
      border-radius: var(--radius-md);
      background: transparent;
      cursor: pointer;
      text-align: left;
      transition: background-color 0.1s ease;
    }

    .dropdown-option:hover {
      background: var(--avs-hover-bg);
    }

    .dropdown-option:focus-visible {
      outline: var(--focus-ring);
      outline-offset: -2px;
    }

    .dropdown-option.selected {
      background: var(--avs-selected-bg);
    }

    .dropdown-option.selected:hover {
      background: var(--avs-selected-bg-hover);
    }

    .option-content {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .option-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--avs-text);
    }

    .option-desc {
      font-size: var(--text-xs);
      color: var(--avs-muted);
    }

    .dropdown-option.selected .option-label {
      color: var(--avs-selected-fg);
    }

    .check-icon {
      width: 16px;
      height: 16px;
      color: var(--avs-check-fg);
      flex-shrink: 0;
    }
  `],
})
export class AvSettingsComponent {
  readonly room = inject(RoomConnectionService);
  readonly variant = input<'dropdown' | 'inline'>('dropdown');
  readonly onClose = output<void>();
  readonly noiseLevels = NOISE_LEVELS;

  onLevelChange(level: AudioNoiseSuppressionLevel): void {
    this.room.agora.setNoiseSuppressionLevel(level);
    this.onClose.emit();
  }
}
