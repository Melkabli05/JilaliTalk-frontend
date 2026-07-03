import { Injectable, PLATFORM_ID, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwUpdate, VersionReadyEvent, VersionInstallationFailedEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { StorageService } from './storage.service';

interface PwaUpdatePrefs {
  /** User dismissed this specific version hash — don't auto-reprompt for it. */
  dismissedHash: string | null;
  /** User disabled update checks entirely — manual "Check for updates" still works. */
  disabled: boolean;
}

const PREFS_KEY = 'pwa-update-prefs';
const DEFAULT_PREFS: PwaUpdatePrefs = { dismissedHash: null, disabled: false };

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  // SwUpdate is only provided when provideServiceWorker() runs — i.e. production builds.
  // Use { optional: true } so this service is safe to construct in dev mode too.
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly storage = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  /** Whether the service worker is supported and active in this browser. */
  readonly isSupported = this.swUpdate?.isEnabled ?? false;

  /** Whether a new app version is available and ready to activate. */
  readonly updateAvailable = signal(false);

  /** The hash of the new version that is pending activation. */
  readonly pendingVersionHash = signal<string | null>(null);

  /** True while checkForUpdate() is in flight. */
  readonly checking = signal(false);

  /** User-facing failure from the last checkForUpdate() call. Null until a failure occurs. */
  readonly lastError = signal<string | null>(null);

  /** User opted out of update prompts entirely. */
  readonly disabled = signal(DEFAULT_PREFS.disabled);

  /**
   * The banner should be visible iff a new version is ready AND the user hasn't
   * dismissed this specific version AND they haven't disabled prompts altogether.
   */
  readonly shouldShowBanner = computed(() =>
    this.updateAvailable()
    && this.pendingVersionHash() !== this.dismissedHash()
    && !this.disabled(),
  );

  private readonly dismissedHash = signal<string | null>(DEFAULT_PREFS.dismissedHash);

  constructor() {
    this.hydratePrefs();

    if (!this.swUpdate?.isEnabled) return;

    // Persist disabled flag back to storage whenever it flips.
    effect(() => {
      this.storage.set<PwaUpdatePrefs>(PREFS_KEY, {
        dismissedHash: this.dismissedHash(),
        disabled: this.disabled(),
      });
    });

    // A new version was detected and downloaded — prompt the user to reload.
    this.swUpdate.versionUpdates.pipe(
      filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
    ).subscribe((event) => {
      this.pendingVersionHash.set(event.latestVersion.hash);
      this.updateAvailable.set(true);
      this.lastError.set(null);
    });

    // Surface installation failures to lastError so the UI can react if it wants to.
    this.swUpdate.versionUpdates.pipe(
      filter((e): e is VersionInstallationFailedEvent => e.type === 'VERSION_INSTALLATION_FAILED'),
    ).subscribe((event) => {
      this.lastError.set(`Update install failed: ${event.error}`);
    });

    // Re-check when the user returns to the tab / app, so a background-deployed
    // build gets picked up without requiring a manual reload — only when not disabled.
    if (isPlatformBrowser(this.platformId)) {
      const onVisible = () => {
        if (document.visibilityState === 'visible' && !this.disabled()) {
          void this.checkForUpdate();
        }
      };
      document.addEventListener('visibilitychange', onVisible);
      this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
    }
  }

  /** Hydrate persisted preferences on construction so a hard reload remembers the choice. */
  private hydratePrefs(): void {
    const stored = this.storage.get<PwaUpdatePrefs>(PREFS_KEY) ?? DEFAULT_PREFS;
    this.dismissedHash.set(stored.dismissedHash);
    this.disabled.set(stored.disabled);
  }

  /** Check for updates now (call after user interaction, e.g. a "Check for updates" button). */
  async checkForUpdate(): Promise<boolean> {
    if (!this.swUpdate?.isEnabled || this.checking()) return false;
    this.checking.set(true);
    this.lastError.set(null);
    try {
      const updateFound = await this.swUpdate.checkForUpdate();
      return updateFound ?? false;
    } catch (err) {
      this.lastError.set(err instanceof Error ? err.message : 'Update check failed');
      return false;
    } finally {
      this.checking.set(false);
    }
  }

  /** Activate the pending version and reload the page. */
  async activateUpdate(): Promise<void> {
    if (!this.swUpdate?.isEnabled || !this.updateAvailable()) return;
    this.clearDismiss();
    await this.swUpdate.activateUpdate();
    window.location.reload();
  }

  /** Dismiss the pending update (user defers until next session or next version). */
  dismiss(): void {
    this.dismissedHash.set(this.pendingVersionHash());
    this.updateAvailable.set(false);
  }

  /** Permanently disable update prompts. Manual checkForUpdate() still works. */
  setDisabled(value: boolean): void {
    this.disabled.set(value);
    if (value) this.updateAvailable.set(false);
  }

  /** Clear the current "dismissed" version so the banner reappears. */
  clearDismiss(): void {
    this.dismissedHash.set(null);
  }
}