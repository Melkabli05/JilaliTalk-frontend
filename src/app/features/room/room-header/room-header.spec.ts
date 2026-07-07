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

    it('pressing Space on the status dot while disconnected emits refresh', () => {
      fixture.componentRef.setInput('wsStatus', 'disconnected');
      fixture.detectChanges();
      let refreshed = false;
      fixture.componentInstance.refresh.subscribe(() => (refreshed = true));

      const dot = fixture.nativeElement.querySelector('.ws-status') as HTMLElement;
      dot.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(refreshed).toBe(true);
    });
  });

  describe('room info panel', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('name', 'Friday Night Talk');
      fixture.componentRef.setInput('topic', 'Chill vibes only');
      fixture.componentRef.setInput('cname', 'VR_1_42');
      fixture.detectChanges();
    });

    it('is closed by default', () => {
      expect(fixture.nativeElement.querySelector('.room-info-panel')).toBeNull();
    });

    it('opens when the room name is tapped, showing the full topic', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.room-info-panel')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.room-info-value')?.textContent.trim()).toBe(
        'Chill vibes only',
      );
    });

    it('shows the full room id, not truncated', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.cname-text')?.textContent.trim()).toBe('VR_1_42');
    });

    it('copies the room id when the copy row is tapped', () => {
      const clipboard = TestBed.inject(Clipboard);
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      const copyBtn = fixture.nativeElement.querySelector('.room-info-copy') as HTMLElement;
      copyBtn.click();

      expect(clipboard.copy).toHaveBeenCalledWith('VR_1_42');
    });

    it('closes when the backdrop is clicked', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      const backdrop = fixture.nativeElement.querySelector('.info-backdrop') as HTMLElement;
      backdrop.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.room-info-panel')).toBeNull();
    });

    it('closes on Escape', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.room-info-panel')).toBeNull();
    });

    it('emits toggleInvisible when the visibility row is tapped', () => {
      let toggled = false;
      fixture.componentInstance.toggleInvisible.subscribe(() => (toggled = true));
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      const visBtn = fixture.nativeElement.querySelector('.room-info-visibility') as HTMLElement;
      visBtn.click();

      expect(toggled).toBe(true);
    });

    it('closes the panel when the visibility row is tapped', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      const visBtn = fixture.nativeElement.querySelector('.room-info-visibility') as HTMLElement;
      visBtn.click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.room-info-panel')).toBeNull();
    });
  });

  describe('room info panel accessibility', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('name', 'Friday Night Talk');
      fixture.componentRef.setInput('topic', 'Chill vibes only');
      fixture.componentRef.setInput('cname', 'VR_1_42');
      fixture.detectChanges();
    });

    it('has dialog semantics', () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.room-info-panel') as HTMLElement;
      expect(panel.getAttribute('role')).toBe('dialog');
      expect(panel.getAttribute('aria-modal')).toBe('true');
    });

    it('moves focus into the panel on open', async () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      const panel = fixture.nativeElement.querySelector('.room-info-panel') as HTMLElement;
      expect(document.activeElement).toBe(panel);
    });

    it('returns focus to the room-name button on close', async () => {
      const nameBtn = fixture.nativeElement.querySelector('.room-name-btn') as HTMLElement;
      nameBtn.click();
      fixture.detectChanges();
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      fixture.componentInstance.closeRoomInfo();
      fixture.detectChanges();
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      expect(document.activeElement).toBe(nameBtn);
    });
  });

  describe('overflow menu accessibility', () => {
    it('has dialog semantics', () => {
      const moreBtn = fixture.nativeElement.querySelector('.toolbar-btn.c-more') as HTMLElement;
      moreBtn.click();
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.overflow-panel') as HTMLElement;
      expect(panel.getAttribute('role')).toBe('dialog');
      expect(panel.getAttribute('aria-modal')).toBe('true');
    });

    it('moves focus into the panel on open', async () => {
      const moreBtn = fixture.nativeElement.querySelector('.toolbar-btn.c-more') as HTMLElement;
      moreBtn.click();
      fixture.detectChanges();
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      const panel = fixture.nativeElement.querySelector('.overflow-panel') as HTMLElement;
      expect(document.activeElement).toBe(panel);
    });

    it('returns focus to the more-actions button on close', async () => {
      const moreBtn = fixture.nativeElement.querySelector('.toolbar-btn.c-more') as HTMLElement;
      moreBtn.click();
      fixture.detectChanges();
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      fixture.componentInstance.closeOverflow();
      fixture.detectChanges();
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

      expect(document.activeElement).toBe(moreBtn);
    });
  });
});
