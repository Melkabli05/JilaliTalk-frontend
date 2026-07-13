const GIFT_EMOJI: Readonly<Record<number, string>> = {
  53: '🎤',
  175: '🎧',
  14: '🐰',
  31: '💝',
};

export function giftEmojiFor(giftId: number): string {
  return GIFT_EMOJI[giftId] ?? '🎁';
}
