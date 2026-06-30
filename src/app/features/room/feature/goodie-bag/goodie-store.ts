import { Injectable, signal } from '@angular/core';

export interface GoodieQuestion {
  readonly id: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly answer: number;
}

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