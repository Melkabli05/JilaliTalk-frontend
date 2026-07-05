import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

/** Single source of truth for the mobile/desktop shell breakpoint. Referenced by the
 *  app shell (app.ts) and every component that needs to know which layout it's in —
 *  keep it in sync with the `@media (max-width: 1023.98px)` / `(min-width: 1024px)`
 *  queries hardcoded in component styles (CSS can't consume a TS constant, so those
 *  stay literal, but this is the one place the JS-side value is decided). */
export const MOBILE_BREAKPOINT_QUERY = '(max-width: 1023.98px)';

/**
 * Reactive "does this media query currently match" signal, backed by CDK's
 * BreakpointObserver. Defaults to the shell's mobile breakpoint, but accepts any
 * query — e.g. notification-panel.component.ts switches to a bottom-sheet layout
 * at a narrower 768px, which is a deliberately different threshold from the shell's
 * sidebar/nav breakpoint, not a duplicate of it.
 *
 * Replaces the hand-rolled `PLATFORM_ID` + `window.matchMedia` + manual
 * `addEventListener`/`removeEventListener` cleanup that used to be duplicated in
 * app.ts, audience-list.ts, and notification-panel.component.ts — each with a
 * slightly different (and in two of three cases, incomplete) browser-support
 * story. BreakpointObserver's MediaMatcher already checks `Platform.isBrowser`
 * internally and no-ops on the server, so no isPlatformBrowser guard is needed here.
 *
 * Must be called in an injection context (a field initializer or the constructor
 * of a component/directive/service).
 */
export function injectIsMobileViewport(query: string = MOBILE_BREAKPOINT_QUERY): Signal<boolean> {
  const breakpointObserver = inject(BreakpointObserver);
  return toSignal(
    breakpointObserver.observe(query).pipe(map((state) => state.matches)),
    { initialValue: breakpointObserver.isMatched(query) },
  );
}
