import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffRoomSocketService } from './bff-room-socket.service';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = 0; // CONNECTING
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3; // CLOSED
  }
}

describe('BffRoomSocketService', () => {
  let service: BffRoomSocketService;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    // WebSocket constants are checked by the service's isConnected() method
    vi.stubGlobal('WebSocket', Object.assign(FakeWebSocket, { OPEN: 1, CLOSED: 3 }));
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(BffRoomSocketService);
  });

  it('opens a WebSocket to /ws/ht/{cname} with default hostId/busiType', () => {
    service.connect('VR_1_2');
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0]!.url).toBe('/ws/ht/VR_1_2?hostId=0&busiType=2');
  });

  it('carries hostId/busiType/heartbeatSeconds so jilalibff can drive the room heartbeat', () => {
    service.connect('VR_1_2', 555, 1, 30);
    expect(FakeWebSocket.instances[0]!.url).toBe('/ws/ht/VR_1_2?hostId=555&busiType=1&heartbeatSeconds=30');
  });

  it('carries the same hostId/busiType across a reconnect', () => {
    service.connect('VR_1_2', 555, 1);
    FakeWebSocket.instances[0]!.onclose?.();
    vi.advanceTimersByTime(1000);

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1]!.url).toBe('/ws/ht/VR_1_2?hostId=555&busiType=1');
  });

  it('parses an incoming frame as-is — jilalibff already sends camelCase keys', () => {
    service.connect('VR_1_2');
    const sock = FakeWebSocket.instances[0]!;

    sock.onmessage?.({ data: JSON.stringify({ type: 'user_join', userId: '42', nickname: 'Jilali' }) });

    expect(service.lastEvent()).toEqual({ type: 'user_join', userId: '42', nickname: 'Jilali' });
  });

  it('drops a malformed frame without throwing', () => {
    service.connect('VR_1_2');
    const sock = FakeWebSocket.instances[0]!;

    expect(() => sock.onmessage?.({ data: 'not json' })).not.toThrow();
    expect(service.lastEvent()).toBeNull();
  });

  it('reconnects with exponential backoff after the socket closes', () => {
    service.connect('VR_1_2');
    FakeWebSocket.instances[0]!.onclose?.();

    vi.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('stops reconnecting and clears lastEvent after disconnect()', async () => {
    service.connect('VR_1_2');
    await service.disconnect();
    FakeWebSocket.instances[0]!.onclose?.();

    vi.advanceTimersByTime(30_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(service.lastEvent()).toBeNull();
  });

  it('isConnected reflects the underlying socket readyState', () => {
    service.connect('VR_1_2');
    expect(service.isConnected()).toBe(false); // FakeWebSocket starts at readyState 0 (CONNECTING)
    FakeWebSocket.instances[0]!.readyState = 1; // OPEN
    expect(service.isConnected()).toBe(true);
  });
});