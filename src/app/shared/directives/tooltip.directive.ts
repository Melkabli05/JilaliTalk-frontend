import { Directive, input, signal, computed } from '@angular/core';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

@Directive({
  selector: '[appTooltip]',

  host: {
    '[attr.data-tooltip]': 'active() ? "" : null',
    '[attr.data-tooltip-text]': 'active() ? appTooltip() : null',
    '[attr.data-tooltip-position]': 'tooltipPosition()',
    '[attr.data-tooltip-visible]': 'visible() && active() ? "true" : null',
    '[style.--tooltip-z]': 'tooltipZ()',
    '(mouseenter)': 'visible.set(true)',
    '(mouseleave)': 'visible.set(false)',
    '(focusin)': 'visible.set(true)',
    '(focusout)': 'visible.set(false)',
  },
})
export class TooltipDirective {
  readonly appTooltip = input.required<string>();
  readonly tooltipPosition = input<TooltipPosition>('right');
  readonly tooltipZ = input<number | string>(1000);
  readonly tooltipDisabled = input(false);

  protected readonly visible = signal(false);
  protected readonly active = computed(() => !this.tooltipDisabled() && this.appTooltip().trim().length > 0);
}
