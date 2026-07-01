export type DmMessageType = 'text' | 'image' | 'gift' | 'introduction';

export interface DmMessage {
  readonly id: string;
  readonly type: DmMessageType;
  readonly text?: string;
  readonly imageUrl?: string;
  readonly giftId?: number;
  readonly count?: number;
  readonly fromNickname?: string;
  readonly ts: number;
}

export interface DmConversation {
  readonly userId: string;
  readonly nickname: string;
  readonly messages: readonly DmMessage[];
  readonly unread: number;
  readonly lastTs: number;
  readonly isTyping: boolean;
}
