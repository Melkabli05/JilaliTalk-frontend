import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent, VersionDetectedEvent, NoNewVersionDetectedEvent, VersionInstallationFailedEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  // SwUpdate is only provided when provideServiceWorker() runs — i.e. production builds.
  // Use { optional: true } so this service is safe to construct in dev mode too.
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  /** Whether a new app version is available and ready to activate. */
  readonly updateAvailable = signal(false);

  /** The hash of the new version that is pending activation. */
  readonly pendingVersionHash = signal<string | null>(null);

  /** Whether the service worker is supported and active in this browser. */
  readonly isSupported = this.swUpdate?.isEnabled ?? false;

  constructor() {
    if (!this.swUpdate?.isEnabled) return;

    // A new version was detected and downloaded — prompt the user to reload.
    this.swUpdate.versionUpdates.pipe(
      filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
    ).subscribe(() => {
      this.updateAvailable.set(true);
    });

    // Log version lifecycle events for debugging — ngsw/state shows these too.
    this.swUpdate.versionUpdates.pipe(
      filter((e): e is VersionDetectedEvent | NoNewVersionDetectedEvent | VersionInstallationFailedEvent =>
        e.type === 'VERSION_DETECTED' || e.type === 'NO_NEW_VERSION_DETECTED' || e.type === 'VERSION_INSTALLATION_FAILED',
      ),
    ).subscribe(event => {
      console.debug(`[PwaUpdate] ${event.type}`, event);
    });
  }

  /** Check for updates now (call after user interaction, e.g. a "Check for updates" button). */
  async checkForUpdate(): Promise<boolean> {
    if (!this.swUpdate?.isEnabled) return false;
    try {
      const updateFound = await this.swUpdate.checkForUpdate();
      return updateFound ?? false;
    } catch {
      return false;
    }
  }

  /** Activate the pending version and reload the page. */
  async activateUpdate(): Promise<void> {
    if (!this.swUpdate?.isEnabled) return;
    await this.swUpdate.activateUpdate();
    window.location.reload();
  }

  /** Dismiss the pending update (user defers until next page load). */
  dismiss(): void {
    this.updateAvailable.set(false);
  }
}

