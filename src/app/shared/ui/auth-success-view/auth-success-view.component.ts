import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { LucideArrowRight } from '@lucide/angular';

@Component({
  selector: 'app-auth-success-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, LucideArrowRight],
  template: `
    <div class="success-view" role="main">
      <div class="success-avatar" aria-hidden="true">{{ initial() }}</div>
      <h2 class="success-title" id="auth-dialog-heading">Welcome</h2>
      <p class="success-name" aria-live="polite">{{ nickname() }}</p>
      <p class="success-hint">Your account is ready.</p>
      <app-button variant="primary" size="md" (click)="enter.emit()">
        Enter JilaliTalk
        <svg aria-hidden="true" lucideArrowRight [size]="14"></svg>
      </app-button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .success-view {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: var(--space-4) 0 var(--space-2);
      animation: success-pop 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) both;
    }
    .success-avatar {
      width: 72px; height: 72px; border-radius: 50%;
      background: linear-gradient(135deg, var(--color-warm-400), var(--color-warm-500));
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; font-weight: var(--font-bold); color: var(--color-on-color);
      box-shadow: 0 0 28px color-mix(in srgb, var(--color-warm-500) 40%, transparent);
      margin-bottom: var(--space-4);
    }
    .success-title {
      font-size: var(--text-lg); font-weight: var(--font-bold);
      color: var(--color-text); margin: 0 0 var(--space-1);
    }
    .success-name {
      font-size: var(--text-sm); color: var(--color-warm-500);
      font-weight: var(--font-semibold); margin: 0 0 var(--space-2);
    }
    .success-hint {
      font-size: var(--text-xs); color: var(--color-text-muted);
      margin: 0 0 var(--space-6);
    }

    @keyframes success-pop {
      0% { opacity: 0; transform: scale(0.8); }
      60% { transform: scale(1.05); }
      100% { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .success-view { animation: none; }
    }
  `],
})
export class AuthSuccessViewComponent {
  readonly nickname = input.required<string>();
  readonly enter = output<void>();

  readonly initial = computed(() => {
    const name = this.nickname();
    return name ? name.charAt(0).toUpperCase() : '?';
  });
}