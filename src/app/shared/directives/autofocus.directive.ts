import { Directive, ElementRef, effect, inject, input } from '@angular/core';

@Directive({
  selector: '[appAutofocus]',
})
export class AutofocusDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly appAutofocus = input<unknown>(undefined);
  readonly appAutofocusDelay = input<number>(80);

  constructor() {
    effect(() => {
      this.appAutofocus();
      const el = this.host.nativeElement;
      setTimeout(() => {
        if (typeof el.focus === 'function') el.focus();
      }, this.appAutofocusDelay());
    });
  }
}