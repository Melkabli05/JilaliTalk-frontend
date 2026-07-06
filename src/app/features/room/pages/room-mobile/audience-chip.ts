import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { LucideUsers, LucideChevronUp } from '@lucide/angular';
import { AudienceListComponent } from '../../feature/audience/audience-list';
import { AudienceUser } from '../../data/room-model';

/**
 * Mobile audience entry point. Always-visible pill that shows the listener
 * count and up to three small avatars; tap expands a bottom sheet hosting
 * the existing `app-audience-list` (which already has its own search, view
 * toggle, and collapse affordance). Single source of truth for the
 * audience list lives in `AudienceListComponent` — this component just
 * provides a compact summary + a mobile-native way to open the full view.
 */
@Component({
  selector: 'app-audience-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideUsers, LucideChevronUp, AudienceListComponent],
  template: `
    <button
      type="button"
      class="chip"
      (click)="open.set(!open())"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="ariaLabel()"
    >
      <span class="chip-icon" aria-hidden="true">
        <svg lucideUsers [size]="14"></svg>
      </span>
      <span class="chip-avatars" aria-hidden="true">
        @for (u of previewUsers(); track u.userId) {
          <img class="chip-avatar" [src]="u.base?.headUrl ?? ''" alt="" loading="lazy" />
        }
      </span>
      <span class="chip-label">{{ labelText() }}</span>
      <span class="chip-chevron" [class.is-open]="open()" aria-hidden="true">
        <svg lucideChevronUp [size]="14"></svg>
      </span>
    </button>

    @if (open()) {
      <div class="sheet-backdrop" (click)="open.set(false)" aria-hidden="true"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Audience list">
        <div class="sheet-handle" aria-hidden="true"></div>
        <app-audience-list
          [users]="users()"
          [speakingUids]="speakingUids()"
          [currentUserId]="currentUserId()"
          [canInviteToStage]="canInviteToStage()"
          [inviteBusy]="inviteBusy()"
          (userClick)="userClick.emit($event)"
          (inviteToStage)="inviteToStage.emit($event)"
        />
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      flex-shrink: 0;
    }

    .chip {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--color-card);
      border: none;
      border-top: 1px solid var(--color-border);
      cursor: pointer;
      font-family: inherit;
      font-size: var(--text-sm);
      color: var(--color-text);
      text-align: left;
      min-height: var(--touch-target-min);
      transition: background 0.15s ease;
    }
    .chip:hover { background: var(--color-neutral-50); }
    .chip:active { background: var(--color-neutral-100); }
    .chip:focus-visible {
      outline: var(--focus-ring);
      outline-offset: calc(-1 * var(--focus-ring-offset));
    }

    .chip-icon {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-neutral-100);
      color: var(--color-text-secondary);
      flex-shrink: 0;
    }

    .chip-avatars {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .chip-avatar {
      width: 22px;
      height: 22px;
      border-radius: var(--radius-full);
      border: 2px solid var(--color-card);
      margin-left: -8px;
      object-fit: cover;
      background: var(--color-neutral-200);
    }
    .chip-avatar:first-child { margin-left: 0; }

    .chip-label {
      flex: 1;
      font-weight: var(--font-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chip-chevron {
      color: var(--color-text-muted);
      transition: transform 0.2s ease;
    }
    .chip-chevron.is-open { transform: rotate(180deg); }

    /* Bottom sheet — slides up from the bottom edge; the toolbar/comment-
       input pins stay on top because the chip is inside the page-level
       scroll container (not fixed). */
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-overlay);
      background: color-mix(in srgb, var(--color-surface) 35%, transparent);
      backdrop-filter: blur(8px) saturate(140%);
      -webkit-backdrop-filter: blur(8px) saturate(140%);
      animation: fadeIn 0.18s ease-out;
    }
    .sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: var(--z-overlay);
      max-height: min(80dvh, 640px);
      background: var(--color-card);
      border-top-left-radius: var(--radius-2xl);
      border-top-right-radius: var(--radius-2xl);
      box-shadow: var(--shadow-modal);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .sheet-handle {
      width: 36px;
      height: 4px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-300);
      margin: var(--space-2) auto;
      flex-shrink: 0;
    }
    .sheet app-audience-list {
      flex: 1;
      min-height: 0;
      border-top: 1px solid var(--color-border);
    }

    @media (prefers-reduced-motion: reduce) {
      .sheet-backdrop { animation: none; }
      .sheet { animation: none; }
      .chip-chevron { transition: none; }
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp {
      from { transform: translateY(16px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    :host-context(.dark) .chip:hover { background: var(--color-neutral-800); }
    :host-context(.dark) .chip:active { background: var(--color-neutral-700); }
    :host-context(.dark) .chip-icon { background: var(--color-neutral-700); color: var(--color-neutral-300); }
    :host-context(.dark) .chip-avatar { border-color: var(--color-neutral-800); background: var(--color-neutral-700); }
    :host-context(.dark) .sheet-handle { background: var(--color-neutral-600); }
  `],
})
export class AudienceChipComponent {
  readonly users = input<readonly AudienceUser[]>([]);
  readonly speakingUids = input<readonly number[]>([]);
  readonly currentUserId = input<number>(0);
  readonly canInviteToStage = input<boolean>(false);
  readonly inviteBusy = input<number | null>(null);

  readonly userClick = output<AudienceUser>();
  readonly inviteToStage = output<AudienceUser>();

  readonly open = signal(false);

  /** Up to three real (non-ghost) users with a headUrl for the avatar preview. */
  readonly previewUsers = computed(() =>
    this.users()
      .filter((u) => !u.isGhost && u.base?.headUrl)
      .slice(0, 3),
  );

  readonly count = computed(() => this.users().length);

  readonly labelText = computed(() => {
    const n = this.count();
    if (n === 0) return 'No listeners yet';
    if (n === 1) return '1 listener';
    return `${formatCompact(n)} listening`;
  });

  readonly ariaLabel = computed(() => {
    const n = this.count();
    return `Audience — ${n} ${n === 1 ? 'listener' : 'listeners'}`;
  });
}

function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}