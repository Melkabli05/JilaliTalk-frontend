import { Injectable, InjectionToken, Signal, signal } from '@angular/core';

export interface GoodieQuestion {
  readonly id: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly answer: number;
}

/** Read-only surface for countdown.ts / chibi.ts — they only render the current
 *  question/timer, never start or end the game (that's room-page-base.ts's job). */
export interface GoodieReader {
  readonly isPlaying: Signal<boolean>;
  readonly currentQuestion: Signal<GoodieQuestion | null>;
  readonly timeLeft: Signal<number>;
}

export interface GoodieWriter {
  startGame(): void;
  setQuestion(q: GoodieQuestion): void;
  setTimeLeft(t: number): void;
  endGame(): void;
}

export const GOODIE_READER = new InjectionToken<GoodieReader>('GOODIE_READER');
export const GOODIE_WRITER = new InjectionToken<GoodieWriter>('GOODIE_WRITER');

@Injectable()
export class GoodieStore {
  private readonly _isPlaying = signal(false);
  private readonly _currentQuestion = signal<GoodieQuestion | null>(null);
  private readonly _timeLeft = signal(0);

  readonly isPlaying = this._isPlaying.asReadonly();
  readonly currentQuestion = this._currentQuestion.asReadonly();
  readonly timeLeft = this._timeLeft.asReadonly();

  startGame(): void {
    this._isPlaying.set(true);
  }

  setQuestion(q: GoodieQuestion): void {
    this._currentQuestion.set(q);
  }

  setTimeLeft(t: number): void {
    this._timeLeft.set(t);
  }

  endGame(): void {
    this._isPlaying.set(false);
    this._currentQuestion.set(null);
    this._timeLeft.set(0);
  }
}