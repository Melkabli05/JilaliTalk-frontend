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
    store.minimize('room-123', 2, 'Chill Voice Room', true, false);
    expect(store.minimized()).toBe(true);
    expect(store.cname()).toBe('room-123');
    expect(store.busiType()).toBe(2);
    expect(store.roomName()).toBe('Chill Voice Room');
    expect(store.isMicOn()).toBe(true);
    expect(store.isInvisible()).toBe(false);
  });

  it('minimize() captures invisible state when minimized while invisible', () => {
    store.minimize('room-123', 2, 'Ghost Room', false, true);
    expect(store.isInvisible()).toBe(true);
    expect(store.isMicOn()).toBe(false);
  });

  it('updateMicState() only changes isMicOn, leaves the rest untouched', () => {
    store.minimize('room-123', 2, 'Chill Voice Room', true, false);
    store.updateMicState(false);
    expect(store.isMicOn()).toBe(false);
    expect(store.cname()).toBe('room-123');
  });

  it('setInvisible() flips invisible flag while minimized', () => {
    store.minimize('room-123', 2, 'Chill Voice Room', true, false);
    store.setInvisible(true);
    expect(store.isInvisible()).toBe(true);
  });

  it('clear() resets to nothing minimized and clears invisible flag', () => {
    store.minimize('room-123', 2, 'Chill Voice Room', true, true);
    store.clear();
    expect(store.minimized()).toBe(false);
    expect(store.cname()).toBeNull();
    expect(store.isInvisible()).toBe(false);
  });
});
