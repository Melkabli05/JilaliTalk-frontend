import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);

  private readonly _isDark = signal(false);
  readonly isDark = this._isDark.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('theme');
      this._isDark.set(stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches));
      this.applyTheme();
    }
  }

  toggle(): void {
    this._isDark.update(v => !v);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', this._isDark() ? 'dark' : 'light');
      this.applyTheme();
    }
  }

  private applyTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', this._isDark());
    }
  }
}
