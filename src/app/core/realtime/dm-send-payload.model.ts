export interface DmSendGift {
  readonly id: number;
  readonly name: string;
  readonly multiName: Record<string, string>;
  readonly smallPic: string;
  readonly bigPic?: string;
  readonly animUrl: string;
  readonly diamondVal: number;
  readonly giftType: number;
}

export interface IntroductionPayload {
  readonly userId: number;
  readonly nickname: string;
  readonly headUrl?: string | null;
  readonly sex?: string | null;
  readonly age?: number | null;
  readonly nationality?: string | null;
  readonly bio?: string | null;
}

export type DmSendPayload =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'image';
      readonly url: string;
      readonly localPath?: string;
      readonly size?: number;
      readonly width?: number;
      readonly height?: number;
      readonly mimeType?: string;
    }
  | { readonly kind: 'live_link'; readonly roomData: unknown }
  | { readonly kind: 'voice_room'; readonly roomData: unknown }
  | { readonly kind: 'introduction'; readonly introduction: IntroductionPayload }
  | { readonly kind: 'send_gift'; readonly gift: DmSendGift };
