import { Component, ChangeDetectionStrategy, input, output, signal, computed, viewChild, ElementRef, effect } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { LucideCrown } from '@lucide/angular';
import { getCountryByCode } from '@shared/data/countries';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
export type AvatarShape = 'circle' | 'rounded' | 'square';
export type AvatarStatus = 'online' | 'offline' | 'speaking';

@Component({
  selector: 'app-avatar',

  imports: [NgOptimizedImage, LucideCrown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'avatar',
    '[class.avatar-xs]': 'size() === "xs"',
    '[class.avatar-sm]': 'size() === "sm"',
    '[class.avatar-md]': 'size() === "md"',
    '[class.avatar-lg]': 'size() === "lg"',
    '[class.avatar-xl]': 'size() === "xl"',
    '[class.avatar-xxl]': 'size() === "xxl"',
    '[class.avatar-circle]': 'shape() === "circle"',
    '[class.avatar-rounded]': 'shape() === "rounded"',
    '[class.avatar-square]': 'shape() === "square"',
    '[class.avatar-loading]': 'loading()',
    '[class.avatar-speaking]': 'speaking()',
    '[style.--avatar-ring-color]': 'ringColor() || null',
    '[style.--avatar-size]': 'customSize() || null',
    '[attr.role]': 'showImage() ? null : "img"',
    '[attr.aria-label]': 'showImage() ? null : computedLabel()',
    '[attr.tabindex]': 'clickable() ? 0 : null',
    '(click)': 'onHostClick($event)',
    '(keydown.enter)': 'onHostClick($event)',
    '(keydown.space)': 'onHostClick($event); $event.preventDefault()',
  },
  template: `
    @if (loading()) {
      <span class="avatar-skeleton"></span>
    } @else if (showImage()) {
      @if (priority()) {
        <img
          class="avatar-img"
          fill
          [ngSrc]="src()"
          [alt]="alt()"
          [priority]="true"
          (error)="onImageError()"
        />
      } @else {
        <img
          class="avatar-img"
          fill
          [ngSrc]="src()"
          [alt]="alt()"
          loading="lazy"
          (error)="onImageError()"
        />
      }
    } @else {
      <span class="avatar-fallback" aria-hidden="true">{{ computedInitials() }}</span>
    }

    @if (crownType()) {
      <span class="avatar-crown" [class]="'crown-' + crownType()">
        <svg aria-hidden="true" lucideCrown [size]="crownSize()" />
      </span>
    }

    @if (flagCode()) {
      <img
        class="avatar-flag"
        [ngSrc]="'https://flagcdn.com/w20/' + flagCode()!.toLowerCase() + '.png'"
        [alt]="flagCountryName()"
        width="14"
        height="10"
        loading="lazy"
      />
    }

    @if (previewing()) {
      <div
        class="avatar-preview-backdrop"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="alt()"
        (click)="closePreview($event)"
        (keydown.escape)="closePreview($event)"
        tabindex="-1"
        #previewBackdrop
      >
        <button type="button" class="avatar-preview-close" aria-label="Close preview" (click)="closePreview($event)">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <img
          class="avatar-preview-img"
          [src]="src()"
          [alt]="alt()"
          (click)="$event.stopPropagation()"
        />
      </div>
    }
  `,
  styles: [
    `
      :host {
        --avatar-ring-color: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-full);
        background-color: var(--color-primary-500);
        color: var(--color-on-color);
        font-weight: var(--font-medium);
        overflow: visible;
        flex-shrink: 0;
        border: 2px solid var(--avatar-ring-color, transparent);
        position: relative;
        cursor: default;
        box-sizing: content-box;
      }
      :host([style.--avatar-size]) {
        width: var(--avatar-size);
        height: var(--avatar-size);
      }
      :host(.avatar-circle) {
        border-radius: var(--radius-full);
      }
      :host(.avatar-rounded) {
        border-radius: var(--radius-xl);
      }
      :host(.avatar-square) {
        border-radius: 0;
      }
      :host(.avatar-loading) {
        cursor: wait;
      }

      :host([tabindex='0']) {
        cursor: pointer;
      }
      :host([tabindex='0']:hover) {
        opacity: 0.9;
      }
      :host(:focus-visible) {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }

      :host(.avatar-xs) {
        width: var(--space-5);
        height: var(--space-5);
        font-size: 10px;
      }
      :host(.avatar-sm) {
        width: var(--space-7);
        height: var(--space-7);
        font-size: var(--text-xs);
      }
      :host(.avatar-md) {
        width: var(--space-9);
        height: var(--space-9);
        font-size: var(--text-sm);
      }
      :host(.avatar-lg) {
        width: var(--space-12);
        height: var(--space-12);
        font-size: var(--text-base);
      }
      :host(.avatar-xl) {
        width: var(--space-16);
        height: var(--space-16);
        font-size: var(--text-lg);
      }
      :host(.avatar-xxl) {
        width: 80px;
        height: 80px;
        font-size: var(--text-xl);
      }

      .avatar-img {
        object-fit: cover;
        border-radius: inherit;
        display: block;
      }

      .avatar-fallback {
        text-transform: uppercase;
        letter-spacing: 0.5px;
        user-select: none;
      }

      .avatar-skeleton {
        width: 60%;
        height: 60%;
        border-radius: var(--radius-full);
        background-color: color-mix(in srgb, var(--color-neutral-400) 30%, transparent);
        animation: skeleton-pulse 1.2s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .avatar-skeleton {
          animation: none;
          opacity: 0.6;
        }
      }

      :host(.avatar-speaking) {
        animation: avatar-speak-ring 0.7s ease-in-out infinite;
        border-color: var(--color-accent-400) !important;
      }
      @keyframes avatar-speak-ring {
        0%, 100% {
          box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent-400) 60%, transparent);
        }
        50% {
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-accent-400) 40%, transparent);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        :host(.avatar-speaking) {
          animation: none;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-400) 100%, transparent);
        }
      }
      .avatar-flag {
        position: absolute;
        bottom: -2px;
        left: -2px;
        border-radius: 2px;
        border: 1px solid var(--color-border);
        z-index: 2;
        pointer-events: none;
        object-fit: cover;
      }

      :host-context(.dark) {
        background-color: var(--color-primary-400);
        /* On dark mode, the avatar's primary-500 fill can read flat against a dark backdrop.
           A subtle inset gives the placeholder initials real presence without changing shape. */
        box-shadow: inset 0 0 0 1px hsl(0deg 0% 100% / 8%);
        .avatar-flag { border-color: var(--color-neutral-600); }
      }

      :host(.avatar-xs) .avatar-flag { width: 10px; height: 7px; }
      :host(.avatar-sm) .avatar-flag { width: 12px; height: 8px; }
      :host(.avatar-md) .avatar-flag { width: 14px; height: 10px; }
      :host(.avatar-lg) .avatar-flag,
      :host(.avatar-xl) .avatar-flag,
      :host(.avatar-xxl) .avatar-flag { width: 16px; height: 11px; }
      .avatar-crown {
        position: absolute;
        top: -13px;
        left: 50%;
        transform: translateX(-50%);
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 1px solid;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
      }
      .avatar-crown.crown-1 {
        background: var(--color-gold-100);
        border-color: var(--color-gold-200);
        color: var(--color-gold-500);
      }
      .avatar-crown.crown-2 {
        background: var(--color-primary-50);
        border-color: var(--color-primary-200);
        color: var(--color-primary-500);
      }

      :host(.avatar-xs) .avatar-crown {
        width: 12px;
        height: 12px;
        top: -4px;
      }
      :host(.avatar-xs) .avatar-crown svg {
        width: 6px;
        height: 6px;
      }
      :host(.avatar-sm) .avatar-crown {
        width: 14px;
        height: 14px;
        top: -5px;
      }
      :host(.avatar-sm) .avatar-crown svg {
        width: 7px;
        height: 7px;
      }
      :host(.avatar-md) .avatar-crown {
        width: 16px;
        height: 16px;
      }
      :host(.avatar-md) .avatar-crown svg {
        width: 8px;
        height: 8px;
      }
      :host(.avatar-lg) .avatar-crown {
        width: 20px;
        height: 20px;
      }
      :host(.avatar-lg) .avatar-crown svg {
        width: 10px;
        height: 10px;
      }
      :host(.avatar-xl) .avatar-crown,
      :host(.avatar-xxl) .avatar-crown {
        width: 20px;
        height: 20px;
      }
      :host(.avatar-xl) .avatar-crown svg,
      :host(.avatar-xxl) .avatar-crown svg {
        width: 16px;
        height: 16px;
      }

      .avatar-preview-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-6) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
        padding-top: max(var(--space-6), env(safe-area-inset-top));
        background: transparent;
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        cursor: zoom-out;
        animation: avatar-preview-fade-in 0.15s ease-out;
      }
      @keyframes avatar-preview-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .avatar-preview-img {
        max-width: min(94vw, 720px);
        max-height: 90vh;
        width: auto;
        height: auto;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-modal);
        cursor: default;
        object-fit: contain;
      }
      .avatar-preview-close {
        position: absolute;
        top: max(var(--space-4), env(safe-area-inset-top));
        right: var(--space-4);
        width: var(--touch-target-min);
        height: var(--touch-target-min);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-full);
        border: none;
        background: color-mix(in srgb, var(--color-black) 40%, transparent);
        color: white;
        cursor: pointer;
      }
      .avatar-preview-close svg {
        width: 18px;
        height: 18px;
      }
      .avatar-preview-close:focus-visible,
      .avatar-preview-backdrop:focus-visible {
        outline: var(--focus-ring);
        outline-offset: var(--focus-ring-offset);
      }
      @media (prefers-reduced-motion: reduce) {
        .avatar-preview-backdrop { animation: none; }
      }
    `,
  ],
})
export class AvatarComponent {
  readonly src = input<string>('');
  readonly alt = input<string>('User avatar');
  readonly size = input<AvatarSize>('md');
  readonly customSize = input<string | null>(null);
  readonly shape = input<AvatarShape>('circle');
  readonly initials = input<string | null>(null);
  readonly status = input<AvatarStatus | null>(null);
  readonly ringColor = input<string | null>(null);
  readonly crownType = input<1 | 2 | null>(null);
  readonly speaking = input<boolean>(false);
  readonly flagCode = input<string | null>(null);
  readonly loading = input<boolean>(false);
  readonly clickable = input<boolean>(false);
  readonly priority = input<boolean>(false);
  readonly avatarClick = output<MouseEvent | KeyboardEvent>();

  protected readonly failed = signal(false);

  readonly showImage = computed(() => !!this.src() && !this.failed());

  readonly computedInitials = computed(() => {
    if (this.initials()) return this.initials()!.slice(0, 2);
    const text = this.alt() ?? 'User';
    const parts = text.trim().split(/\s+/);
    if (parts.length === 1) return (parts[0] ?? '').slice(0, 2);
    const first = (parts[0] ?? '').charAt(0);
    const second = (parts[1] ?? '').charAt(0);
    return first + second;
  });

  readonly computedLabel = computed(() =>
    this.showImage() ? this.alt() : `User avatar for ${this.computedInitials()}`,
  );

  readonly crownSize = computed(() => {
    switch (this.size()) {
      case 'xs':
        return 6;
      case 'sm':
        return 7;
      case 'md':
        return 8;
      case 'lg':
        return 10;
      case 'xl':
      case 'xxl':
        return 12;
      default:
        return 8;
    }
  });

  readonly flagCountry = computed(() => {
    const code = this.flagCode();
    return code ? getCountryByCode(code) : undefined;
  });
  readonly flagCountryName = computed(() => this.flagCountry()?.name ?? '');

  protected onImageError(): void {
    this.failed.set(true);
  }

  protected readonly previewing = signal(false);
  private readonly previewBackdrop = viewChild<ElementRef<HTMLElement>>('previewBackdrop');

  constructor() {
    effect(() => {
      if (this.previewing()) {
        this.previewBackdrop()?.nativeElement.focus();
      }
    });
  }

  onHostClick(event: Event): void {
    if (!this.clickable()) return;
    event.stopPropagation();
    if (this.showImage()) {
      this.previewing.set(true);
    }
    this.avatarClick.emit(event as MouseEvent | KeyboardEvent);
  }

  closePreview(event: Event): void {
    event.stopPropagation();
    this.previewing.set(false);
  }
}
