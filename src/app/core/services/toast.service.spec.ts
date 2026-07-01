import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService, TOAST_EXIT_MS } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('action() creates a toast carrying the given actions', () => {
    const run = vi.fn();
    service.action('Approve?', [{ label: 'Approve', run }]);

    const toasts = service.toasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toBe('Approve?');
    expect(toasts[0]!.actions).toEqual([{ label: 'Approve', run }]);
  });

  it('action() defaults type to info and duration to 20000ms', () => {
    service.action('Approve?', [{ label: 'Approve', run: () => {} }]);

    const toast = service.toasts()[0]!;
    expect(toast.type).toBe('info');
    expect(toast.duration).toBe(20_000);
  });

  it('action() accepts an explicit type and duration override', () => {
    service.action('Muted', [{ label: 'Undo', run: () => {} }], { type: 'warning', duration: 5000 });

    const toast = service.toasts()[0]!;
    expect(toast.type).toBe('warning');
    expect(toast.duration).toBe(5000);
  });

  it('auto-dismisses an actionable toast after its duration elapses, without invoking any action', () => {
    const run = vi.fn();
    service.action('Approve?', [{ label: 'Approve', run }]);

    vi.advanceTimersByTime(20_000);
    vi.advanceTimersByTime(TOAST_EXIT_MS);

    expect(service.toasts()).toHaveLength(0);
    expect(run).not.toHaveBeenCalled();
  });
});
