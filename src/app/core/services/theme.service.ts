import { Service, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { StorageService } from '@core/services/storage.service';

const THEME_KEY = 'theme';

@Service()
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private storage = inject(StorageService);

  private readonly _isDark = signal(false);
  readonly isDark = this._isDark.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stored = this.storage.get<string>(THEME_KEY);
      this._isDark.set(stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches));
      this.applyTheme();
    }
  }

  toggle(): void {
    this._isDark.update(v => !v);
    if (isPlatformBrowser(this.platformId)) {
      this.storage.set(THEME_KEY, this._isDark() ? 'dark' : 'light');
      this.applyTheme();
    }
  }

  private applyTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', this._isDark());
    }
  }
}
