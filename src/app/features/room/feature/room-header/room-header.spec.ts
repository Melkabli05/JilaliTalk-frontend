import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Clipboard } from '@angular/cdk/clipboard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock agora-rtm-sdk to prevent Worker errors in test environment
vi.mock('agora-rtm-sdk', () => ({
  AgoraRTM: class {},
}));

import { RoomHeaderComponent } from './room-header';

describe('RoomHeaderComponent', () => {
  let fixture: ComponentFixture<RoomHeaderComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RoomHeaderComponent],
      providers: [{ provide: Clipboard, useValue: { copy: vi.fn(() => true) } }],
    });
    fixture = TestBed.createComponent(RoomHeaderComponent);
  });

  describe('connection status', () => {
    it('clicking the status dot while disconnected emits refresh', () => {
      fixture.componentRef.setInput('wsStatus', 'disconnected');
      fixture.detectChanges();
      let refreshed = false;
      fixture.componentInstance.refresh.subscribe(() => (refreshed = true));

      const dot = fixture.nativeElement.querySelector('.ws-status') as HTMLElement;
      dot.click();

      expect(refreshed).toBe(true);
    });

    it('clicking the status dot while connected does not emit refresh', () => {
      fixture.componentRef.setInput('wsStatus', 'connected');
      fixture.detectChanges();
      let refreshed = false;
      fixture.componentInstance.refresh.subscribe(() => (refreshed = true));

      const dot = fixture.nativeElement.querySelector('.ws-status') as HTMLElement;
      dot.click();

      expect(refreshed).toBe(false);
    });

    it('clicking the status dot while reconnecting does not emit refresh', () => {
      fixture.componentRef.setInput('wsStatus', 'reconnecting');
      fixture.detectChanges();
      let refreshed = false;
      fixture.componentInstance.refresh.subscribe(() => (refreshed = true));

      const dot = fixture.nativeElement.querySelector('.ws-status') as HTMLElement;
      dot.click();

      expect(refreshed).toBe(false);
    });
  });
});
