import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KeyboardInsetService } from '@core/services/keyboard-inset.service';

interface ShowcaseRoom {
  readonly title: string;
  readonly initials: readonly string[];
  readonly hues: readonly ('primary' | 'accent' | 'warm' | 'gold' | 'social' | 'berry')[];
  readonly live?: boolean;
  readonly count: string;
}

const HUE_CLASS: Record<ShowcaseRoom['hues'][number], string> = {
  primary: 'bg-blue-400',
  accent: 'bg-emerald-400',
  warm: 'bg-red-400',
  gold: 'bg-amber-400',
  social: 'bg-sky-400',
  berry: 'bg-pink-400',
};

/**
 * Shared chrome for the two fullscreen, chromeless auth routes (/login, /signup — see
 * app.routes.ts's `fullscreen: true` data flag, which strips the global header/sidenav/
 * mobile-nav for these).
 *
 * The split isn't decorative padding: the left panel is the one place in this redesign that
 * says what JilaliTalk actually is (live voice rooms, real people, several languages at
 * once) instead of a content-free auth-template background. The three room previews are
 * static illustration, not live data — `aria-hidden`, never wired to RoomApi — built from
 * this app's own category hues (see badge.component.ts's primary/accent/warm/gold set,
 * extended here with the social/berry tones `avatar`-adjacent surfaces already use) rather
 * than a two-stop brand gradient. Collapses away below 1024px: a phone screen doesn't have
 * room to spare on illustration, so mobile gets a slim colored strip and goes straight to
 * the form.
 */
@Component({
  selector: 'app-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { class: 'contents' },
  template: `
    <div
      class="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] min-h-[100dvh] bg-neutral-50 dark:bg-neutral-950"
      [style.--kb-inset.px]="keyboardInsetPx()"
    >
      <aside class="hidden lg:flex items-center bg-blue-900 py-10 px-10" aria-hidden="true">
        <div class="max-w-[420px] mx-auto flex flex-col gap-8">
          <p class="m-0 text-xs font-bold tracking-[0.08em] uppercase text-blue-200/80">JilaliTalk</p>
          <h2 class="m-0 text-[30px] leading-[1.2] font-bold tracking-[-0.01em] text-white [text-wrap:balance]">Real conversations,<br />with real people, live.</h2>
          <ul class="list-none m-0 p-0 flex flex-col gap-3">
            @for (room of rooms; track room.title) {
              <li class="flex items-center gap-3 py-3 px-4 rounded-lg bg-white/6 border border-white/10">
                <span class="flex shrink-0">
                  @for (initial of room.initials; track $index) {
                    <span
                      class="w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold text-white
                             border-2 border-blue-900 -ml-2 first:ml-0"
                      [class]="hueClass(room, $index)"
                    >{{ initial }}</span>
                  }
                </span>
                <span class="flex flex-col gap-0.5 min-w-0">
                  <span class="text-sm font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis">{{ room.title }}</span>
                  <span class="flex items-center gap-1 text-xs text-white/60">
                    @if (room.live) {
                      <span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                    }
                    {{ room.count }}
                  </span>
                </span>
              </li>
            }
          </ul>
        </div>
      </aside>

      <main
        class="flex flex-col min-w-0 min-h-[100dvh] box-border
               [padding:max(1.25rem,env(safe-area-inset-top))_max(1.25rem,env(safe-area-inset-right))_max(1.5rem,env(safe-area-inset-bottom))_max(1.25rem,env(safe-area-inset-left))]"
        id="main-content"
        tabindex="-1"
      >
        <a
          routerLink="/rooms"
          class="inline-flex self-start items-center gap-2 no-underline rounded-md lg:hidden
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          aria-label="JilaliTalk home"
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="authBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6"/>
                <stop offset="100%" stop-color="#10b981"/>
              </linearGradient>
            </defs>
            <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" fill="url(#authBrandGrad)"/>
            <path d="M16 8l-8 4v8l8 4 8-4v-8l-8-4z" fill="white" fill-opacity="0.25"/>
            <path d="M12 16l4-4 4 4-4 4-4-4z" fill="white"/>
          </svg>
          <span class="text-base font-bold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100">JilaliTalk</span>
        </a>

        <div
          class="flex-1 min-w-0 flex flex-col justify-start pt-8 lg:justify-center lg:pt-0 w-full max-w-[400px] mx-auto gap-5 box-border
                 [padding-block-end:calc(1.5rem_+_var(--kb-inset,0px))]"
          role="region"
          [attr.aria-labelledby]="titleId"
        >
          <header class="flex flex-col gap-3 items-center">
            <span
              class="w-12 h-12 rounded-full inline-flex items-center justify-center lg:hidden [&>svg]:w-6 [&>svg]:h-6
                     bg-blue-50 text-blue-700 dark:bg-blue-600/25 dark:text-blue-300"
              aria-hidden="true"
            >
              <ng-content select="[auth-icon]" />
            </span>
            <h1 class="text-[26px] font-bold tracking-[-0.02em] text-neutral-900 dark:text-neutral-100 m-0" [id]="titleId">{{ title() }}</h1>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 m-0 [&>strong]:text-neutral-900 [&>strong]:font-medium dark:[&>strong]:text-neutral-100">
              <ng-content select="[auth-subtitle]" />
            </p>
          </header>

          <ng-content />

          <p class="text-sm text-neutral-500 dark:text-neutral-400 m-0">
            <ng-content select="[auth-footer]" />
          </p>
        </div>
      </main>
    </div>
  `,
})
export class AuthShellComponent {
  readonly title = input.required<string>();
  protected readonly keyboardInsetPx = inject(KeyboardInsetService).keyboardInsetPx;

  private static nextId = 0;
  protected readonly titleId = `auth-shell-title-${AuthShellComponent.nextId++}`;

  protected readonly rooms: readonly ShowcaseRoom[] = [
    { title: 'English ↔ Spanish', initials: ['M', 'L', 'A'], hues: ['primary', 'accent', 'gold'], live: true, count: '18 in the room' },
    { title: '日本語 Practice Circle', initials: ['K', 'Y'], hues: ['berry', 'social'], live: true, count: '7 in the room' },
    { title: 'Learn French Together', initials: ['S', 'R', 'N'], hues: ['warm', 'primary', 'accent'], count: 'Starts in 10 min' },
  ];

  protected hueClass(room: ShowcaseRoom, index: number): string {
    return HUE_CLASS[room.hues[index] ?? 'primary'];
  }
}
