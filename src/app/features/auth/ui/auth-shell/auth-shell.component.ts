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
  template: `
    <div class="auth-shell" [style.--kb-inset.px]="keyboardInsetPx()">
      <aside class="showcase" aria-hidden="true">
        <div class="showcase-content">
          <p class="showcase-eyebrow">JilaliTalk</p>
          <h2 class="showcase-headline">Real conversations,<br />with real people, live.</h2>
          <ul class="room-list">
            @for (room of rooms; track room.title) {
              <li class="room-chip">
                <span class="room-avatars">
                  @for (initial of room.initials; track $index) {
                    <span class="room-avatar" [class]="'hue-' + room.hues[$index]">{{ initial }}</span>
                  }
                </span>
                <span class="room-info">
                  <span class="room-title">{{ room.title }}</span>
                  <span class="room-meta">
                    @if (room.live) {
                      <span class="live-dot"></span>
                    }
                    {{ room.count }}
                  </span>
                </span>
              </li>
            }
          </ul>
        </div>
      </aside>

      <main class="auth-main" id="main-content" tabindex="-1">
        <a routerLink="/rooms" class="brand-mark" aria-label="JilaliTalk home">
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 32 32" fill="none">
            <defs>
              <linearGradient id="authBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="var(--color-primary-500)"/>
                <stop offset="100%" stop-color="var(--color-accent-500)"/>
              </linearGradient>
            </defs>
            <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" fill="url(#authBrandGrad)"/>
            <path d="M16 8l-8 4v8l8 4 8-4v-8l-8-4z" fill="white" fill-opacity="0.25"/>
            <path d="M12 16l4-4 4 4-4 4-4-4z" fill="white"/>
          </svg>
          <span class="brand-name">JilaliTalk</span>
        </a>

        <div class="form-wrap" role="region" [attr.aria-labelledby]="titleId">
          <header class="form-header">
            <span class="form-icon" aria-hidden="true">
              <ng-content select="[auth-icon]" />
            </span>
            <h1 class="form-title" [id]="titleId">{{ title() }}</h1>
            <p class="form-sub">
              <ng-content select="[auth-subtitle]" />
            </p>
          </header>

          <ng-content />

          <p class="alt">
            <ng-content select="[auth-footer]" />
          </p>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .auth-shell {
      display: grid;
      /* minmax(0, 1fr), not a bare 1fr: grid items default to min-width:auto, which floors
         their shrink at the content's min-content size — on a narrow phone that content
         (the "Send verification code" button, the email input) is wider than the viewport,
         so without the explicit 0 floor the whole page overflows horizontally instead of
         the form wrapping/shrinking to fit. Same reasoning on .auth-main/.form-wrap below. */
      grid-template-columns: minmax(0, 1fr);
      min-height: 100dvh;
      background: var(--color-bg);
    }
    @media (min-width: 1024px) {
      .auth-shell { grid-template-columns: minmax(0, 5fr) minmax(0, 4fr); }
    }

    /* ── Showcase panel (desktop only) ── */
    .showcase {
      display: none;
      background: var(--color-primary-900);
      padding: var(--space-10) var(--space-10);
      align-items: center;
    }
    @media (min-width: 1024px) {
      .showcase { display: flex; }
    }
    .showcase-content {
      max-width: 420px;
      margin-inline: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-8);
    }
    .showcase-eyebrow {
      margin: 0;
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--color-primary-200) 80%, transparent);
    }
    .showcase-headline {
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
      font-weight: var(--font-bold);
      letter-spacing: -0.01em;
      color: white;
      text-wrap: balance;
    }

    .room-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .room-chip {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, white 6%, transparent);
      border: 1px solid color-mix(in srgb, white 10%, transparent);
    }
    .room-avatars {
      display: flex;
      flex-shrink: 0;
    }
    .room-avatar {
      width: 30px;
      height: 30px;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: var(--font-bold);
      color: white;
      border: 2px solid var(--color-primary-900);
      margin-left: -8px;
    }
    .room-avatar:first-child { margin-left: 0; }
    .hue-primary { background: var(--color-primary-400); }
    .hue-accent  { background: var(--color-accent-400); }
    .hue-warm    { background: var(--color-warm-400); }
    .hue-gold    { background: var(--color-gold-400); }
    .hue-social  { background: var(--color-social-400); }
    .hue-berry   { background: var(--color-berry-400); }

    .room-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .room-title {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: white;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .room-meta {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      color: color-mix(in srgb, white 60%, transparent);
    }
    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-live);
      flex-shrink: 0;
    }

    /* ── Form panel ── */
    .auth-main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 100dvh;
      padding: max(var(--space-5), env(safe-area-inset-top)) max(var(--space-5), env(safe-area-inset-right)) max(var(--space-6), env(safe-area-inset-bottom)) max(var(--space-5), env(safe-area-inset-left));
      box-sizing: border-box;
    }

    .brand-mark {
      display: inline-flex;
      align-self: flex-start;
      align-items: center;
      gap: var(--space-2);
      text-decoration: none;
      border-radius: var(--radius-md);
    }
    .brand-mark:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-ring-offset);
    }
    .brand-name {
      font-size: var(--text-base);
      font-weight: var(--font-bold);
      letter-spacing: -0.02em;
      color: var(--color-text);
    }
    @media (min-width: 1024px) {
      .brand-mark { display: none; }
    }

    .form-wrap {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      /* Top-aligned on mobile, not vertically centered: centering left the icon/title
         floating in the middle of a mostly-empty screen with the form itself pushed down
         near the bottom half — the more familiar pattern (Duolingo, most iOS sign-in
         screens) starts the form a fixed distance from the top so it's the first thing in
         view, with no keyboard-driven jump when a field gets focus. The desktop form panel
         is paired with a same-height showcase panel, where vertical centering reads as
         intentional balance rather than empty space, so only mobile changes. */
      justify-content: flex-start;
      padding-top: var(--space-8);
      width: 100%;
      max-width: 400px;
      margin-inline: auto;
      gap: var(--space-5);
      padding-block-end: calc(var(--space-6) + var(--kb-inset, 0px));
      box-sizing: border-box;
    }
    @media (min-width: 1024px) {
      .form-wrap {
        justify-content: center;
        padding-top: 0;
      }
    }

    .form-header {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      align-items: center;
    }
    .form-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-full);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary-50);
      color: var(--color-primary-text);
    }
    .form-icon svg {
      width: 24px;
      height: 24px;
    }
    .dark .form-icon {
      background: color-mix(in srgb, var(--color-primary-600) 25%, transparent);
      color: var(--color-primary-300);
    }
    @media (min-width: 1024px) {
      .form-icon { display: none; }
    }
    .form-title {
      font-size: 26px;
      font-weight: var(--font-bold);
      letter-spacing: -0.02em;
      color: var(--color-text);
      margin: 0;
    }
    .form-sub {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
    }
    .form-sub strong { color: var(--color-text); font-weight: var(--font-medium); }

    .alt {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin: 0;
    }
  `],
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
}
