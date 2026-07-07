import { of, throwError } from 'rxjs';
import { DestroyRef } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ToastService } from '@core/services/toast.service';
import type { RoomApi } from '../api/room-api';
import type { RoomStore } from '../store/room-store';
import type { CommentsStore } from '../comments/comments-store';
import { sendVoiceComment, sendVideoComment } from './send-comment.command';

function fakeDestroyRef(): DestroyRef {
  return { onDestroy: () => () => {} } as unknown as DestroyRef;
}

function fakeRoomStore(): RoomStore {
  return {
    nickname: () => 'Sam',
    headUrl: () => 'https://x/sam.png',
    nationality: () => 'MA',
    myRole: () => 1,
    userId: () => 42,
    busiType: () => 2,
  } as unknown as RoomStore;
}

function fakeApi(): RoomApi {
  return { sendComment: vi.fn(() => of(undefined)) } as unknown as RoomApi;
}

describe('sendVoiceComment', () => {
  it('optimistically inserts the comment locally, tagged with a clientNonce', () => {
    const roomStore = fakeRoomStore();
    const commentsStore = { addComment: vi.fn() } as unknown as CommentsStore;
    const api = fakeApi();

    sendVoiceComment({ text: 'hey' }, 'VR_1_2', roomStore, commentsStore, api, fakeDestroyRef());

    expect(commentsStore.addComment).toHaveBeenCalledTimes(1);
    const inserted = (commentsStore.addComment as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(inserted.clientNonce).toBeTruthy();
    expect(inserted.userId).toBe(42);
    expect(inserted.msg.text.text).toBe('hey');
  });

  it('sends the same clientNonce to the server as the locally-inserted comment', () => {
    const roomStore = fakeRoomStore();
    const commentsStore = { addComment: vi.fn() } as unknown as CommentsStore;
    const api = fakeApi();

    sendVoiceComment({ text: 'hey' }, 'VR_1_2', roomStore, commentsStore, api, fakeDestroyRef());

    const inserted = (commentsStore.addComment as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(api.sendComment).toHaveBeenCalledWith(
      expect.objectContaining({ clientNonce: inserted.clientNonce }),
    );
  });
});

describe('sendVideoComment', () => {
  it('does not touch CommentsStore — video has no local optimistic echo', () => {
    const roomStore = fakeRoomStore();
    const api = fakeApi();
    const toast = new ToastService();

    sendVideoComment({ text: 'hey' }, 'VR_1_2', roomStore, api, toast, fakeDestroyRef());

    expect(api.sendComment).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error toast when the send fails', () => {
    const roomStore = fakeRoomStore();
    const api = { sendComment: vi.fn(() => throwError(() => new Error('boom'))) } as unknown as RoomApi;
    const toast = new ToastService();

    sendVideoComment({ text: 'hey' }, 'VR_1_2', roomStore, api, toast, fakeDestroyRef());

    expect(toast.toasts()).toHaveLength(1);
    expect(toast.toasts()[0]!.type).toBe('error');
  });
});
