import { TestBed, ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService, TOAST_EXIT_MS } from '@core/services/toast.service';

describe('ToastContainerComponent', () => {
  let fixture: ComponentFixture<ToastContainerComponent>;
  let toastService: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [ToastContainerComponent] });
    fixture = TestBed.createComponent(ToastContainerComponent);
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('renders no action row for a plain toast', () => {
    toastService.info('Just FYI');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.toast-actions')).toBeNull();
  });

  it('renders one button per action, in order', () => {
    toastService.action('Approve?', [
      { label: 'Approve', run: () => {} },
      { label: 'Dismiss', run: () => {} },
    ]);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.toast-action');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent.trim()).toBe('Approve');
    expect(buttons[1].textContent.trim()).toBe('Dismiss');
  });

  it('clicking an action button runs it and dismisses the toast', () => {
    const run = vi.fn();
    toastService.action('Approve?', [{ label: 'Approve', run }]);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.toast-action') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(run).toHaveBeenCalledOnce();
    expect(toastService.toasts()[0]!.leaving).toBe(true);

    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(toastService.toasts()).toHaveLength(0);
  });
});
