import { Component, ChangeDetectionStrategy, inject, output } from '@angular/core';
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
      z-index: 50;
      display: block;
    }

    .dropdown-panel {
      width: 240px;
      background: var(--color-card);
      border: 1px solid var(--color-border);
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

    .dropdown-panel::before {
      content: '';
      position: absolute;
      top: -6px;
      right: 12px;
      width: 10px;
      height: 10px;
      background: var(--color-card);
      border-left: 1px solid var(--color-border);
      border-top: 1px solid var(--color-border);
      transform: rotate(45deg);
    }

    .dropdown-header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--color-text-secondary);
      border-bottom: 1px solid var(--color-border);
      background: var(--color-neutral-50);
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
      background: var(--color-neutral-100);
    }

    .dropdown-option:focus-visible {
      outline: var(--focus-ring);
      outline-offset: -2px;
    }

    .dropdown-option.selected {
      background: var(--color-primary-50);
    }

    .dropdown-option.selected:hover {
      background: var(--color-primary-100);
    }

    .option-content {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .option-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
    }

    .option-desc {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .dropdown-option.selected .option-label {
      color: var(--color-primary-700);
    }

    .check-icon {
      width: 16px;
      height: 16px;
      color: var(--color-primary-600);
      flex-shrink: 0;
    }

    :host-context(.dark) .dropdown-panel {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }

    :host-context(.dark) .dropdown-panel::before {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }

    :host-context(.dark) .dropdown-header {
      background: var(--color-neutral-700);
      color: var(--color-neutral-300);
      border-color: var(--color-neutral-700);
    }

    :host-context(.dark) .dropdown-option:hover {
      background: var(--color-neutral-700);
    }

    :host-context(.dark) .dropdown-option.selected {
      background: color-mix(in srgb, var(--color-primary-900) 40%, transparent);
    }

    :host-context(.dark) .dropdown-option.selected:hover {
      background: color-mix(in srgb, var(--color-primary-900) 60%, transparent);
    }

    :host-context(.dark) .option-label {
      color: var(--color-neutral-100);
    }

    :host-context(.dark) .option-desc {
      color: var(--color-neutral-400);
    }

    :host-context(.dark) .dropdown-option.selected .option-label {
      color: var(--color-primary-300);
    }

    :host-context(.dark) .check-icon {
      color: var(--color-primary-400);
    }
  `],
})
export class AvSettingsComponent {
  readonly room = inject(RoomConnectionService);
  readonly onClose = output<void>();
  readonly noiseLevels = NOISE_LEVELS;

  onLevelChange(level: AudioNoiseSuppressionLevel): void {
    this.room.agora.setNoiseSuppressionLevel(level);
    this.onClose.emit();
  }
}
