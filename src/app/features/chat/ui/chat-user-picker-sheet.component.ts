import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { LucideSearch, LucideX } from '@lucide/angular';
import { UserListItemComponent } from '@shared/ui/user-list/user-list-item';
import type { ChatUserPickerTab, ChatUserSummary } from '../models/chat-message.model';
import { asNumericPeerId } from '../utils/chat-ids';

const PICKER_TABS: ReadonlyArray<{ readonly id: ChatUserPickerTab; readonly label: string }> = [
  { id: 'following', label: 'Following' },
  { id: 'followers', label: 'Followers' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'byId', label: 'By ID' },
];

@Component({
  selector: 'app-chat-user-picker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, UserListItemComponent, LucideSearch, LucideX],
  host: {
    '(keydown.escape)': 'onEscape()',
  },
  template: `
    <div
      class="backdrop"
      [class.open]="open()"
      (click)="onBackdropClick($event)"
      role="presentation"
    ></div>
    <div
      class="sheet"
      [class.open]="open()"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      [cdkTrapFocus]="open()"
      cdkTrapFocusAutoCapture
      tabindex="-1"
    >
      <header class="sheet-header">
        <span class="sheet-title">{{ title() }}</span>
        <button type="button" class="sheet-close" (click)="close.emit()" aria-label="Close">
          <svg aria-hidden="true" lucideX [size]="16"></svg>
        </button>
      </header>
      <nav class="tabs" role="tablist">
        @for (t of tabs; track t.id) {
          <button
            type="button"
            role="tab"
            class="tab"
            [class.tab--active]="tab() === t.id"
            [attr.aria-selected]="tab() === t.id"
            (click)="tabChange.emit(t.id)"
          >{{ t.label }}</button>
        }
      </nav>
      @switch (tab()) {
        @case ('byId') {
          <form class="byid-form" (submit)="$event.preventDefault(); submitById.emit()">
            <svg aria-hidden="true" lucideSearch [size]="14" class="byid-icon"></svg>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              class="byid-field"
              placeholder="Enter user ID"
              [value]="byIdQuery()"
              (input)="byIdQueryChange.emit($any($event.target).value)"
              aria-label="User ID"
            />
            <button type="submit" class="byid-submit" [disabled]="!byIdValid()">Find</button>
          </form>
        }
      }
      <div class="list" role="tabpanel">
        @if (loading()) {
          <p class="status">Loading…</p>
        } @else if (error()) {
          <p class="status status--error">{{ error() }}</p>
        } @else if (byIdView(); as view) {
          <button type="button" class="byid-result" (click)="onByIdPicked(view)">
            <app-user-list-item
              [userId]="asUserId(view.userId)"
              [name]="view.nickname"
              [headUrl]="view.headUrl"
              [nationality]="view.nationality ?? null"
              variant="followers"
            />
          </button>
        } @else if (users().length === 0) {
          <p class="status">{{ emptyCopy() }}</p>
        } @else {
          @for (u of users(); track u.userId) {
            <app-user-list-item
              [userId]="asUserId(u.userId)"
              [name]="u.nickname"
              [headUrl]="u.headUrl"
              [nationality]="u.nationality ?? null"
              [isMutual]="u.isMutual ?? false"
              variant="followers"
              (userClick)="pick.emit(u)"
            />
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .backdrop {
      position: fixed; inset: 0; z-index: var(--z-modal-backdrop);
      background: transparent; opacity: 0;
      transition: opacity 220ms ease, background-color 220ms ease;
    }
    .backdrop.open { background: hsl(0deg 0% 0% / 50%); opacity: 1; }
    .sheet {
      position: fixed; left: 0; right: 0; bottom: 0; top: auto;
      height: calc(100dvh - var(--app-header-height));
      z-index: var(--z-modal);
      background: var(--color-card);
      border-top-left-radius: 14px; border-top-right-radius: 14px;
      box-shadow: 0 -12px 24px hsl(0deg 0% 0% / 10%);
      display: flex; flex-direction: column; overflow: hidden;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      transform: translateY(100%); opacity: 0;
      transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 220ms ease;
    }
    .sheet.open { transform: translateY(0); opacity: 1; }
    .sheet-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border); flex-shrink: 0;
    }
    .sheet-title { font-size: var(--text-base); font-weight: var(--font-semibold); }
    .sheet-close {
      width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
      border: 0; background: transparent; color: var(--color-text-muted);
      border-radius: var(--radius-full); cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .sheet-close:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .sheet-close:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .tabs {
      display: flex; gap: 4px; padding: var(--space-2) var(--space-4);
      border-bottom: 1px solid var(--color-border); flex-shrink: 0;
      overflow-x: auto; scrollbar-width: none;
    }
    .tabs::-webkit-scrollbar { display: none; }
    .tab {
      min-height: 44px; padding: 6px 12px; border-radius: var(--radius-full);
      border: 0; background: transparent; cursor: pointer;
      font-size: var(--text-sm); font-weight: var(--font-medium);
      color: var(--color-text-muted); flex-shrink: 0;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .tab.tab--active { background: var(--color-primary-50); color: var(--color-primary-700); }
    .tab:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    :host-context(.dark) .tab.tab--active { background: var(--color-primary-900); color: var(--color-primary-200); }
    .byid-form {
      display: flex; align-items: center; gap: var(--space-2);
      margin: var(--space-2) var(--space-3); padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border); border-radius: var(--radius-lg);
      background: var(--color-card); flex-shrink: 0;
    }
    .byid-form:has(.byid-field:focus-visible) { border-color: var(--color-primary-400); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-500) 14%, transparent); }
    .byid-icon { color: var(--color-text-muted); flex-shrink: 0; }
    .byid-field {
      flex: 1; min-width: 0; border: 0; background: transparent; outline: 0;
      font: inherit; font-size: max(16px, var(--text-sm)); color: var(--color-text);
    }
    .byid-submit {
      min-height: 44px; padding: 4px var(--space-3); border-radius: var(--radius-full);
      background: var(--color-primary-500); color: var(--color-on-color);
      border: 0; font-size: var(--text-xs); font-weight: var(--font-semibold);
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .byid-submit:disabled { background: var(--color-neutral-200); color: var(--color-text-muted); cursor: not-allowed; }
    .byid-submit:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    :host-context(.dark) .byid-submit:disabled { background: var(--color-neutral-700); }
    .byid-result {
      width: 100%; min-height: 44px; text-align: left; background: transparent;
      border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .byid-result:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .list { overflow-y: auto; padding: var(--space-2); flex: 1; min-height: 0; }
    .status {
      margin: var(--space-4); font-size: var(--text-sm);
      color: var(--color-text-muted); text-align: center;
    }
    .status--error { color: var(--color-danger); }
    @media (prefers-reduced-motion: reduce) {
      .backdrop, .sheet { transition-duration: 0.001ms; }
    }
  `],
})
export class ChatUserPickerSheetComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('Select a user');
  readonly tab = input<ChatUserPickerTab>('following');
  readonly users = input<readonly ChatUserSummary[]>([]);
  readonly byIdView = input<ChatUserSummary | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly emptyCopy = input<string>('No users.');
  readonly byIdQuery = input<string>('');
  readonly byIdValid = input<boolean>(false);

  readonly close = output<void>();
  readonly tabChange = output<ChatUserPickerTab>();
  readonly pick = output<ChatUserSummary>();
  readonly submitById = output<void>();
  readonly byIdQueryChange = output<string>();

  protected readonly tabs = PICKER_TABS;

  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });
  }

  protected onEscape(): void {
    if (this.open()) this.close.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }

  protected onByIdPicked(u: ChatUserSummary): void {
    this.pick.emit(u);
  }

  protected readonly asUserId = asNumericPeerId;
}