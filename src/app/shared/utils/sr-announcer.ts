import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SrAnnouncer {
  readonly message = signal('');

  announce(text: string): void {
    this.message.set('');
    setTimeout(() => this.message.set(text), 50);
  }
}