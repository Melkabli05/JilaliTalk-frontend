import type { IntroductionPayload } from '@core/realtime/ht-protocol/packet-framer.util';

export type ChatComposerPhase = 'idle' | 'sending' | 'failed';

export interface ChatComposerState {
  readonly draft: string;
  readonly stagedIntroduction: IntroductionPayload | null;
  readonly phase: ChatComposerPhase;
}