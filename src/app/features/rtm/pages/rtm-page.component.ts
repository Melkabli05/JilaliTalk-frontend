import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-rtm-page',

  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div>RTM - Coming Soon</div>`,
  styles: [`div { padding: var(--space-4); color: var(--color-text); }`]
})
export class RtmPageComponent {}
