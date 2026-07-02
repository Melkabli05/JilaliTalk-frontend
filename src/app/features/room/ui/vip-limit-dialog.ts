import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { LucideCrown } from '@lucide/angular';
import { ModalComponent } from '@shared/ui/modal/modal.component';
import { OptionCardComponent } from '@shared/ui/option-card/option-card.component';

export type VipLimitChoice = 'leave' | 'continue' | 'claim';

@Component({
  selector: 'app-vip-limit-dialog',
  imports: [ModalComponent, LucideCrown, OptionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal>
      <div class="banner">
        <div class="banner-icon">
          <svg lucideCrown [size]="28" />
        </div>
        <div class="banner-text">
          <span class="banner-label">VIP Preview</span>
          <h2 class="banner-title">That's your daily limit for today</h2>
        </div>
      </div>

      <div class="body">
        <p class="lead">
          You've been listening as a free user. Upgrade to VIP and unlock
          <strong>unlimited access</strong> for 24 hours — on the house.
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
      width: 360px;
      max-width: calc(100vw - var(--space-6));

      --vld-banner-bg:    linear-gradient(135deg,
                            color-mix(in srgb, var(--color-gold-100) 60%, var(--color-neutral-50)),
                            var(--color-neutral-50));
      --vld-border:       var(--color-border);
      --vld-icon-bg:      color-mix(in srgb, var(--color-gold-400) 20%, transparent);
      --vld-icon-fg:      var(--color-gold-600);
      --vld-label-fg:     var(--color-gold-600);
      --vld-title-fg:     var(--color-text);
      --vld-lead-fg:      var(--color-text-secondary);
      --vld-lead-strong:  var(--color-text);
    }
    :host-context(.dark) {
      --vld-banner-bg:    linear-gradient(135deg,
                            color-mix(in srgb, var(--color-gold-900) 40%, var(--color-neutral-800)),
                            var(--color-neutral-800));
      --vld-border:       var(--color-neutral-700);
      --vld-icon-bg:      color-mix(in srgb, var(--color-gold-700) 30%, transparent);
      --vld-icon-fg:      var(--color-gold-400);
      --vld-label-fg:     var(--color-gold-400);
      --vld-title-fg:     var(--color-neutral-100);
      --vld-lead-fg:      var(--color-neutral-300);
      --vld-lead-strong:  var(--color-neutral-100);
    }

    .banner {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      background: var(--vld-banner-bg);
      border-bottom: 1px solid var(--vld-border);
    }

    .banner-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      background: var(--vld-icon-bg);
      color: var(--vld-icon-fg);
      flex-shrink: 0;
    }

    .banner-label {
      display: block;
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      letter-spacing: var(--letter-spacing-wide);
      text-transform: uppercase;
      color: var(--vld-label-fg);
      margin-bottom: 2px;
    }

    .banner-title {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--vld-title-fg);
      margin: 0;
      line-height: 1.3;
    }

    .body {
      padding: var(--space-4) var(--space-5);
    }

    .lead {
      margin: 0 0 var(--space-4);
      font-size: var(--text-sm);
      color: var(--vld-lead-fg);
      line-height: 1.6;
    }

    .lead strong {
      color: var(--vld-lead-strong);
      font-weight: var(--font-semibold);
    }
  `],
})
export class VipLimitDialogComponent {
  private readonly ref = inject(DialogRef<VipLimitChoice>);

  readonly optionCards = [
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
      title: 'Leave',
      description: 'Come back tomorrow',
      value: 'leave' as const,
      iconClass: 'leave-icon',
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
      title: 'Listen quietly',
      description: 'Join as a lurker, no one sees you',
      value: 'continue' as const,
      variantClass: 'option-card--subtle',
      iconClass: 'listen-icon',
    },
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      title: 'Try VIP free',
      description: '24 hours, no card needed',
      value: 'claim' as const,
      variantClass: 'option-card--gold',
      iconClass: 'gold-icon',
    },
  ] as const;

  choose(choice: unknown): void {
    this.ref.close(choice as VipLimitChoice);
  }
}
