import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-private-list',

  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="private-list">Private rooms coming soon</div>`,
  styles: [`
    .private-list { padding: var(--space-4); text-align: center; color: var(--color-text-muted); font-size: var(--text-sm); }
  `]
})
export class PrivateList {}