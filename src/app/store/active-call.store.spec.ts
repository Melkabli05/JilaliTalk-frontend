import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ActiveCallStore } from './active-call.store';

describe('ActiveCallStore', () => {
  let store: ActiveCallStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ActiveCallStore);
  });

  it('starts with nothing minimized', () => {
    expect(store.minimized()).toBe(false);
    expect(store.cname()).toBeNull();
  });

  it('minimize() sets all fields and flips minimized to true', () => {
    store.minimize('room-123', 2, 'Chill Voice Room', true);
    expect(store.minimized()).toBe(true);
    expect(store.cname()).toBe('room-123');
    expect(store.busiType()).toBe(2);
    expect(store.roomName()).toBe('Chill Voice Room');
    expect(store.isMicOn()).toBe(true);
  });

  it('updateMicState() only changes isMicOn, leaves the rest untouched', () => {
    store.minimize('room-123', 2, 'Chill Voice Room', true);
    store.updateMicState(false);
    expect(store.isMicOn()).toBe(false);
    expect(store.cname()).toBe('room-123');
  });

  it('clear() resets to nothing minimized', () => {
    store.minimize('room-123', 2, 'Chill Voice Room', true);
    store.clear();
    expect(store.minimized()).toBe(false);
    expect(store.cname()).toBeNull();
  });
});
