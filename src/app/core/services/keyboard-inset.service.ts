import { Injectable, PLATFORM_ID, DestroyRef, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Tracks the soft-keyboard inset via the `visualViewport` API so pinned
 * bottom-of-viewport UI (the comment-input bar is the primary consumer) can
 * lift itself above the keyboard on iOS and Android.
 *
 * Browser-only: on the server, both signals return their zero values and the
 * listener is never registered. The platform check happens once at construct.
 *
 * Why a singleton: any two listeners on `visualViewport.resize` would both
 * measure and re-set state — duplicate work and a race. Root-provided so any
 * component can `inject(KeyboardInsetService)` without prop-drilling.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardInsetService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _keyboardInsetPx = signal(0);
  /** Pixels of bottom inset caused by an open soft keyboard. Zero when closed. */
  readonly keyboardInsetPx = this._keyboardInsetPx.asReadonly();

  /** True when the soft keyboard is currently visible. */
  readonly isKeyboardOpen = computed(() => this._keyboardInsetPx() > 0);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (typeof window === 'undefined' || !('visualViewport' in window)) return;

    const recompute = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      // The keyboard inset is the layout-viewport (window.innerHeight) minus
      // the visual-viewport (what's actually visible after the keyboard pushes
      // the layout viewport up). On desktop, the two are equal, so the inset
      // is 0. iOS Safari reports a positive value when the keyboard is open
      // even though `window.innerHeight` doesn't shrink.
      const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      this._keyboardInsetPx.set(inset);
    };

    const viewport = window.visualViewport;
    if (!viewport) return;
    viewport.addEventListener('resize', recompute);
    viewport.addEventListener('scroll', recompute);
    recompute();

    this.destroyRef.onDestroy(() => {
      window.visualViewport?.removeEventListener('resize', recompute);
      window.visualViewport?.removeEventListener('scroll', recompute);
    });
  }
}
