import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { IntroductionPayload } from '@core/realtime/ht-protocol/packet-framer.util';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-chat-introduction-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountryFlagComponent, AvatarComponent],
  template: `
    <div class="intro-bubble" [class.is-outbound]="isOutbound()">
      <span class="intro-context">{{ context() }}</span>
      <button
        type="button"
        class="intro-card"
        [attr.aria-label]="'View ' + target().nickname + '’s profile'"
        (click)="viewProfile.emit()"
      >
        <app-avatar
          [src]="target().headUrl ?? ''"
          [initials]="initials()"
          [alt]="target().nickname"
          size="md"
        />
        <span class="intro-body">
          <span class="intro-name">{{ target().nickname }}</span>
          @if (target().nationality) {
            <app-country-flag [code]="target().nationality!" [compact]="true" />
          }
          @if (target().bio) {
            <span class="intro-bio">{{ target().bio }}</span>
          }
          <span class="intro-cta">View profile →</span>
        </span>
      </button>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .intro-bubble {
      display: flex; flex-direction: column; gap: 6px;
      padding: 8px 12px; border-radius: 12px;
      background: var(--color-neutral-100); color: var(--color-text);
      max-width: min(75%, 420px);
    }
    .intro-bubble.is-outbound { background: var(--color-primary-50); align-self: flex-end; }
    :host-context(.dark) .intro-bubble { background: var(--color-neutral-800); }
    :host-context(.dark) .intro-bubble.is-outbound { background: var(--color-primary-900); }
    .intro-context { font-size: var(--text-xs); color: var(--color-text-muted); }
    .intro-card {
      display: flex; gap: 10px; padding: 8px;
      border-radius: 10px; background: var(--color-card); border: 1px solid var(--color-border);
      text-align: left; cursor: pointer; align-items: center;
      color: var(--color-text);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .intro-card:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .intro-body { display: flex; flex-direction: column; gap: 2px; }
    .intro-name { font-weight: var(--font-semibold); font-size: var(--text-sm); }
    .intro-bio { font-size: var(--text-xs); color: var(--color-text-muted); }
    .intro-cta { font-size: var(--text-xs); color: var(--color-primary-600); font-weight: var(--font-medium); }
  `],
})
export class ChatIntroductionBubbleComponent {
  readonly target = input.required<IntroductionPayload>();
  readonly context = input.required<string>();
  readonly isOutbound = input<boolean>(false);

  readonly viewProfile = output<void>();

  protected readonly initials = computed(() => (this.target().nickname || '?').slice(0, 2));
}