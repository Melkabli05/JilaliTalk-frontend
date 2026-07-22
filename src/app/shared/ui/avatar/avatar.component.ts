import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { LucideCrown } from '@lucide/angular';
import { getCountryByCode } from '@shared/data/countries';
import { AvatarPreviewDialogComponent } from './avatar-preview-dialog.component';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
export type AvatarShape = 'circle' | 'rounded' | 'square';
export type AvatarStatus = 'online' | 'offline' | 'speaking';

/** width/height/font-size per size step — Tailwind's own spacing/text scale. */
const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  xxl: 'w-20 h-20 text-xl',
};
const SHAPE_CLASSES: Record<AvatarShape, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-xl',
  square: 'rounded-none',
};
const FLAG_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-2.5 h-[7px]',
  sm: 'w-3 h-2',
  md: 'w-3.5 h-2.5',
  lg: 'w-4 h-[11px]',
  xl: 'w-4 h-[11px]',
  xxl: 'w-4 h-[11px]',
};
const CROWN_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-3 h-3 -top-1 [&_svg]:w-1.5 [&_svg]:h-1.5',
  sm: 'w-3.5 h-3.5 -top-[5px] [&_svg]:w-[7px] [&_svg]:h-[7px]',
  md: 'w-4 h-4 [&_svg]:w-2 [&_svg]:h-2',
  lg: 'w-5 h-5 [&_svg]:w-2.5 [&_svg]:h-2.5',
  xl: 'w-5 h-5 [&_svg]:w-4 [&_svg]:h-4',
  xxl: 'w-5 h-5 [&_svg]:w-4 [&_svg]:h-4',
};

@Component({
  selector: 'app-avatar',

  imports: [NgOptimizedImage, LucideCrown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
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
      <span class="w-3/5 h-3/5 rounded-full bg-neutral-400/30 animate-pulse motion-reduce:animate-none motion-reduce:opacity-60"></span>
    } @else if (showImage()) {
      @if (priority()) {
        <img
          class="object-cover rounded-[inherit] block"
          fill
          [ngSrc]="src()"
          [alt]="alt()"
          [priority]="true"
          (error)="onImageError()"
        />
      } @else {
        <img
          class="object-cover rounded-[inherit] block"
          fill
          [ngSrc]="src()"
          [alt]="alt()"
          loading="lazy"
          (error)="onImageError()"
        />
      }
    } @else {
      <span class="uppercase tracking-wide select-none" aria-hidden="true">{{ computedInitials() }}</span>
    }

    @if (crownType()) {
      <span
        class="absolute left-1/2 -translate-x-1/2 rounded-full border flex items-center justify-center z-2"
        [class]="crownClasses()"
      >
        <svg aria-hidden="true" lucideCrown [size]="crownSize()" />
      </span>
    }

    @if (flagCode()) {
      <img
        class="absolute -bottom-0.5 -left-0.5 rounded-sm border border-neutral-200 dark:border-neutral-600 z-2 pointer-events-none object-cover"
        [class]="flagSizeClass()"
        [ngSrc]="'https://flagcdn.com/w20/' + flagCode()!.toLowerCase() + '.png'"
        [alt]="flagCountryName()"
        width="14"
        height="10"
        loading="lazy"
      />
    }
  `,
  /**
   * Remaining non-utility CSS: the two custom keyframe animations (avatar-speak-ring's ring
   * pulse, unique motion design not replicable by Tailwind's built-in spin/ping/pulse/bounce),
   * and the --avatar-ring-color/--avatar-size CSS custom properties, which are genuine
   * per-instance runtime values (a consumer-supplied ring color or arbitrary size), not
   * design-system tokens — those two host bindings stay as-is above.
   */
  styles: [`
    :host { --avatar-ring-color: transparent; }
    :host([style*='--avatar-size']) { width: var(--avatar-size); height: var(--avatar-size); }
    :host(.avatar-speaking) {
      animation: avatar-speak-ring 0.7s ease-in-out infinite;
      border-color: var(--avatar-ring-color, #34d399) !important;
    }
    @keyframes avatar-speak-ring {
      0%, 100% { box-shadow: 0 0 0 0 rgb(52 211 153 / 60%); }
      50% { box-shadow: 0 0 0 4px rgb(52 211 153 / 40%); }
    }
    @media (prefers-reduced-motion: reduce) {
      :host(.avatar-speaking) {
        animation: none;
        box-shadow: 0 0 0 2px rgb(52 211 153 / 100%);
      }
    }
  `],
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

  readonly hostClasses = computed(() => {
    const classes = [
      'inline-flex items-center justify-center font-medium relative shrink-0 cursor-default',
      '[border:2px_solid_var(--avatar-ring-color,transparent)] [box-sizing:content-box]',
      'bg-blue-500 text-white dark:bg-blue-400',
      // Dark mode: on a dark backdrop the flat bg-blue-400 fill can read flat; a subtle inset
      // highlight gives the placeholder initials real presence without changing shape.
      'dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/8%)]',
      SHAPE_CLASSES[this.shape()],
      this.customSize() ? '' : SIZE_CLASSES[this.size()],
    ];
    if (this.loading()) classes.push('cursor-wait');
    if (this.clickable()) classes.push('cursor-pointer hover:opacity-90');
    classes.push('focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500');
    if (this.speaking()) classes.push('avatar-speaking');
    return classes.join(' ');
  });

  readonly flagSizeClass = computed(() => FLAG_SIZE_CLASSES[this.size()]);
  readonly crownClasses = computed(() => {
    const type = this.crownType();
    const palette = type === 1
      ? 'bg-amber-100 border-amber-200 text-amber-500'
      : 'bg-blue-50 border-blue-200 text-blue-500';
    return `${CROWN_SIZE_CLASSES[this.size()]} ${palette} top-[-13px]`;
  });

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

  private readonly dialog = inject(Dialog);

  onHostClick(event: Event): void {
    if (!this.clickable()) return;
    event.stopPropagation();
    if (this.showImage()) {
      this.dialog.open(AvatarPreviewDialogComponent, {
        data: { src: this.src(), alt: this.alt() },
      });
    }
    this.avatarClick.emit(event as MouseEvent | KeyboardEvent);
  }
}
