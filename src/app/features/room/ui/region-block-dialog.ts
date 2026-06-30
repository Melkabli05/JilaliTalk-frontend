import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { LucideShieldOff } from '@lucide/angular';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { OptionCardComponent } from '@shared/ui/option-card/option-card.component';
import { AREA_NOT_OPEN_CODE, LIVE_BANNED_CODE } from '@core/models/api-error';

export type RegionBlockChoice = 'leave' | 'ghost';

export interface RegionBlockDialogData {
  readonly code: number;
}

const CODE_LABELS: Record<number, string> = {
  [AREA_NOT_OPEN_CODE]: 'This room type is not available in your region.',
  [LIVE_BANNED_CODE]: 'Your account is restricted from live rooms.',
};

@Component({
  selector: 'app-region-block-dialog',
  imports: [ModalComponent, LucideShieldOff, OptionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="title">
      <div class="banner">
        <div class="banner-icon">
          <svg lucideShieldOff [size]="24" />
        </div>
        <div class="banner-text">
          <span class="banner-label">Access Restricted</span>
          <p class="banner-message">{{ message }}</p>
        </div>
      </div>

      <div class="body">
        <p class="lead">
          You can still listen without an account — you'll join as a ghost listener
          and won't appear in the participant list.
        </p>

        <app-option-card
          [options]="optionCards"
          (cardSelected)="choose($event)"
        />
      </div>
    </app-modal>
  `,
  styles: [`
    :host {
      display: block;
      width: 340px;
      max-width: calc(100vw - var(--space-6));
    }

    .banner {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      background: color-mix(in srgb, var(--color-warm-50) 60%, var(--color-neutral-50));
      border-bottom: 1px solid var(--color-border);
    }

    :host-context(.dark) .banner {
      background: color-mix(in srgb, var(--color-warm-900) 40%, var(--color-neutral-800));
    }

    .banner-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--color-warm-100) 50%, transparent);
      color: var(--color-warm-600);
      flex-shrink: 0;
    }

    :host-context(.dark) .banner-icon {
      background: color-mix(in srgb, var(--color-warm-800) 60%, transparent);
      color: var(--color-warm-400);
    }

    .banner-label {
      display: block;
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      letter-spacing: var(--letter-spacing-wide);
      text-transform: uppercase;
      color: var(--color-warm-600);
      margin-bottom: 2px;
    }

    :host-context(.dark) .banner-label {
      color: var(--color-warm-400);
    }

    .banner-message {
      margin: 0;
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: 1.4;
    }

    .body {
      padding: var(--space-4) var(--space-5);
    }

    .lead {
      margin: 0 0 var(--space-4);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.6;
    }
  `],
})
export class RegionBlockDialogComponent {
  private readonly ref = inject(DialogRef<RegionBlockChoice>);
  readonly data = inject<RegionBlockDialogData>(DIALOG_DATA);

  get title(): string {
    return this.data.code === LIVE_BANNED_CODE ? 'Account Restricted' : 'Region Restricted';
  }

  get message(): string {
    return CODE_LABELS[this.data.code] ?? 'You cannot join this room.';
  }

  readonly optionCards = [
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
      title: 'Join as ghost',
      description: 'Listen anonymously, no one sees you',
      value: 'ghost' as const,
      iconClass: 'ghost-icon',
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
      title: 'Leave',
      description: 'Go back to the room list',
      value: 'leave' as const,
      variantClass: 'option-card--muted',
      iconClass: 'leave-icon',
    },
  ] as const;

  choose(choice: unknown): void {
    this.ref.close(choice as RegionBlockChoice);
  }
}
