import { Injectable, signal, computed } from '@angular/core';

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
  readonly variant?: 'primary' | 'ghost';
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
  leaving?: boolean;
  actions?: readonly ToastAction[];
}

/** Must match the `.toast-leaving` exit animation duration in toast-container.component.ts. */
export const TOAST_EXIT_MS = 200;

/** Default auto-dismiss window for an actionable toast — longer than a plain
 *  toast's 3000ms default so there's real time to read and decide. */
const ACTION_TOAST_DURATION_MS = 20_000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private enqueue(toast: Toast): void {
    this._toasts.update(current => [toast, ...current]);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.dismiss(toast.id), toast.duration);
    }
  }

  show(message: string, type: Toast['type'] = 'info', duration = 3000): void {
    this.enqueue({ id: crypto.randomUUID(), message, type, duration });
  }

  /** A toast carrying one or more action buttons (e.g. Accept/Decline). Tapping
   *  an action runs it and dismisses immediately; the ✕ button or timeout expiry
   *  just dismisses without running anything. */
  action(
    message: string,
    actions: readonly ToastAction[],
    opts?: { type?: Toast['type']; duration?: number },
  ): void {
    this.enqueue({
      id: crypto.randomUUID(),
      message,
      type: opts?.type ?? 'info',
      duration: opts?.duration ?? ACTION_TOAST_DURATION_MS,
      actions,
    });
  }

  dismiss(id: string): void {
    this._toasts.update(current =>
      current.map(t => (t.id === id ? { ...t, leaving: true } : t)),
    );
    setTimeout(() => {
      this._toasts.update(current => current.filter(t => t.id !== id));
    }, TOAST_EXIT_MS);
  }

  success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }
}
