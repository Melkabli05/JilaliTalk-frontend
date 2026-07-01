import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ROOM_INVITE_GATEWAY } from './room-invite-gateway.token';

describe('ROOM_INVITE_GATEWAY', () => {
  it('has a default no-op factory so injecting it never throws before app.config.ts binds the real one', () => {
    TestBed.configureTestingModule({});
    const gateway = TestBed.inject(ROOM_INVITE_GATEWAY);

    expect(() => gateway.approveStageInvite('VR_1_2', true).subscribe()).not.toThrow();
    expect(() => gateway.approveModInvite('VR_1_2', 42).subscribe()).not.toThrow();
  });
});
