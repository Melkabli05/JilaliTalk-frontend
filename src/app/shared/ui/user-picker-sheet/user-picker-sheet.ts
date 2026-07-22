import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { LucideSearch, LucideX } from '@lucide/angular';
import { UserListItemComponent } from '@shared/ui/user-list/user-list-item';
import { asNumericPeerId } from '@shared/utils';
import type { UserPickerTab, UserSummary } from './user-picker-sheet.model';

const PICKER_TABS: ReadonlyArray<{ readonly id: UserPickerTab; readonly label: string }> = [
  { id: 'following', label: 'Following' },
  { id: 'followers', label: 'Followers' },
  { id: 'visitors', label: 'Visitors' },
  { id: 'byId', label: 'By ID' },
];

/**
 * A generic "pick a user" bottom sheet — following/followers/visitors tabs plus a
 * by-ID lookup. Pure presentational (dumb) component per CLAUDE.md §6: it depends on
 * nothing feature-specific, so it lives in shared/ui rather than any one feature.
 * Originally chat-only (share-profile flow); rooms now reuses it for "share this room
 * with a user" — the caller owns fetching the directory data and sending whatever
 * message the pick represents.
 */
@Component({
  selector: 'app-user-picker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, UserListItemComponent, LucideSearch, LucideX],
  host: {
    '(keydown.escape)': 'onEscape()',
    class: 'contents',
  },
  template: `
    <div
      class="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/50 transition-[opacity,background-color] duration-[220ms]
             motion-reduce:!duration-[0.001ms]"
      [class]="open() ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none bg-transparent'"
      (click)="onBackdropClick($event)"
      role="presentation"
    ></div>
    <div
      class="sheet fixed left-0 right-0 bottom-0 top-auto z-[var(--z-modal)]
             bg-white dark:bg-neutral-900 rounded-t-[14px] shadow-[0_-12px_24px_rgb(0_0_0/10%)]
             flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]
             transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(0.32,0.72,0,1)]
             motion-reduce:!duration-[0.001ms]"
      [class]="open() ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      [cdkTrapFocus]="open()"
      cdkTrapFocusAutoCapture
      tabindex="-1"
    >
      <header class="flex items-center justify-between py-3 px-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
        <span class="text-base font-semibold text-neutral-900 dark:text-neutral-100">{{ title() }}</span>
        <button
          type="button"
          class="w-11 h-11 inline-flex items-center justify-center border-0 bg-transparent text-neutral-500 rounded-full cursor-pointer
                 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
                 transition-colors duration-150
                 hover:bg-neutral-100 hover:text-neutral-900
                 dark:hover:bg-neutral-700 dark:hover:text-neutral-100
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          (click)="close.emit()"
          aria-label="Close"
        >
          <svg aria-hidden="true" lucideX [size]="16"></svg>
        </button>
      </header>
      <nav
        class="flex gap-1 py-2 px-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0 overflow-x-auto
               [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        @for (t of tabs; track t.id) {
          <button
            type="button"
            role="tab"
            class="min-h-11 py-1.5 px-3 rounded-full border-0 bg-transparent cursor-pointer text-sm font-medium
                   text-neutral-500 shrink-0
                   [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            [class]="tab() === t.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : ''"
            [attr.aria-selected]="tab() === t.id"
            (click)="tabChange.emit(t.id)"
          >{{ t.label }}</button>
        }
      </nav>
      @switch (tab()) {
        @case ('byId') {
          <form
            class="flex items-center gap-2 my-2 mx-3 py-2 px-3 border border-neutral-200 dark:border-neutral-700 rounded-lg
                   bg-white dark:bg-neutral-900 shrink-0
                   focus-within:border-blue-400 focus-within:shadow-[0_0_0_3px_rgb(59_130_246/14%)]"
            (submit)="$event.preventDefault(); submitById.emit()"
          >
            <svg aria-hidden="true" lucideSearch [size]="14" class="text-neutral-500 shrink-0"></svg>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              class="flex-1 min-w-0 border-0 bg-transparent outline-none font-[inherit] text-[max(16px,0.875rem)] text-neutral-900 dark:text-neutral-100"
              placeholder="Enter user ID"
              [value]="byIdQuery()"
              (input)="byIdQueryChange.emit($any($event.target).value)"
              aria-label="User ID"
            />
            <button
              type="submit"
              class="min-h-11 py-1 px-3 rounded-full border-0 cursor-pointer text-xs font-semibold
                     [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                     disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed
                     dark:disabled:bg-neutral-700"
              [class]="byIdValid() ? 'bg-blue-500 text-white' : ''"
              [disabled]="!byIdValid()"
            >Find</button>
          </form>
        }
      }
      <div class="overflow-y-auto p-2 flex-1 min-h-0" role="tabpanel">
        @if (loading()) {
          <p class="m-4 text-sm text-neutral-500 text-center">Loading…</p>
        } @else if (error()) {
          <p class="m-4 text-sm text-red-500 text-center">{{ error() }}</p>
        } @else if (byIdView(); as view) {
          <button
            type="button"
            class="w-full min-h-11 text-left bg-transparent border-0 p-0 font-[inherit] text-inherit cursor-pointer
                   [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            (click)="onByIdPicked(view)"
          >
            <app-user-list-item
              [userId]="asUserId(view.userId)"
              [name]="view.nickname"
              [headUrl]="view.headUrl"
              [nationality]="view.nationality ?? null"
              variant="followers"
            />
          </button>
        } @else if (users().length === 0) {
          <p class="m-4 text-sm text-neutral-500 text-center">{{ emptyCopy() }}</p>
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
  /** Remaining structural CSS: the sheet's height/max-height is a calc() coordinating
   *  --app-header-height, --bottom-nav-height, and safe-area insets — the same shell-inset
   *  contract app.ts's :host authors, not a color/style choice. */
  styles: [`
    .sheet {
      max-height: calc(100dvh - var(--app-header-height, 0px) - var(--bottom-nav-height, 0px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
      height: min(85dvh, calc(100dvh - var(--app-header-height, 0px) - var(--bottom-nav-height, 0px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)));
    }
  `],
})
export class UserPickerSheetComponent {
  readonly open = input<boolean>(false);
  readonly title = input<string>('Select a user');
  readonly tab = input<UserPickerTab>('following');
  readonly users = input<readonly UserSummary[]>([]);
  readonly byIdView = input<UserSummary | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly emptyCopy = input<string>('No users.');
  readonly byIdQuery = input<string>('');
  readonly byIdValid = input<boolean>(false);

  readonly close = output<void>();
  readonly tabChange = output<UserPickerTab>();
  readonly pick = output<UserSummary>();
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

  protected onByIdPicked(u: UserSummary): void {
    this.pick.emit(u);
  }

  protected readonly asUserId = asNumericPeerId;
}
