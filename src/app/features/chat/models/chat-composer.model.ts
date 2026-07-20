import type { IntroductionPayload } from '@core/realtime/dm-send-payload.model';

export type ChatComposerPhase = 'idle' | 'sending' | 'failed';

export interface ChatComposerState {
  readonly draft: string;
  readonly stagedIntroduction: IntroductionPayload | null;
  readonly phase: ChatComposerPhase;
}