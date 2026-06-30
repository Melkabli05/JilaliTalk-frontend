import {
  Directive,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  afterNextRender,
} from '@angular/core';

@Directive({
  selector: '[appInfiniteScroll]',

})
export class InfiniteScrollDirective {
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly rootMargin = input<string>('100px');
  readonly debounceMs = input<number>(150);
  readonly scrolledTo = output<void>();

  private observer: IntersectionObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    afterNextRender(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          if (this.debounceTimer !== null) return;
          this.scrolledTo.emit();
          this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
          }, this.debounceMs());
        },
        { rootMargin: this.rootMargin() },
      );
      this.observer.observe(this.el.nativeElement);
    });

    inject(DestroyRef).onDestroy(() => {
      this.observer?.disconnect();
      this.observer = null;
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }
    });
  }
}
