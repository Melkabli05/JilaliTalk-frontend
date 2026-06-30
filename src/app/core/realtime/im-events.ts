export type ImEvent =
  | { readonly type: 'connection-state'; readonly state: 'connecting' | 'connected' | 'disconnected' }
  | { readonly type: 'profile_visit'; readonly visitorUserId: string }
  | { readonly type: 'text_message'; readonly fromUserId: string; readonly text: string; readonly ts: number }
  | { readonly type: 'image_message'; readonly fromUserId: string; readonly imageUrl: string; readonly ts: number }
  | { readonly type: 'voice_room_shared'; readonly fromNickname: string; readonly cname: string; readonly headUrl: string | null; readonly count: number }
  | { readonly type: 'live_room_shared'; readonly fromNickname: string; readonly cname: string; readonly headUrl: string | null }
  | { readonly type: 'account_status'; readonly status: 'banned' | 'session_mismatch' }
  | { readonly type: 'error'; readonly message: string };
