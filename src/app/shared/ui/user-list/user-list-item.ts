import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { relativeTime } from '@shared/utils';
import { LucideCrown, LucideUsers } from '@lucide/angular';

export type UserListItemVariant = 'followers' | 'following' | 'visitors';

@Component({
  selector: 'app-user-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, CountryFlagComponent, LucideCrown, LucideUsers],
  template: `
    <div
      class="flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-colors duration-150
             hover:bg-neutral-100 dark:hover:bg-neutral-800
             focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      role="button"
      tabindex="0"
      [attr.aria-label]="'View ' + name() + '\\'s profile'"
      (click)="userClick.emit(userId())"
      (keydown.enter)="userClick.emit(userId())"
      (keydown.space)="$event.preventDefault(); userClick.emit(userId())"
    >
      <app-avatar [src]="headUrl() ?? ''" [initials]="initials()" size="md" [alt]="name()" />
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <div class="flex items-center gap-1 min-w-0">
          <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100 overflow-hidden text-ellipsis whitespace-nowrap">{{ name() }}</span>
          @if ((vipType() ?? 0) > 0) {
            <svg aria-hidden="true" lucideCrown [size]="11" class="shrink-0 text-amber-500" />
          }
        </div>
        @if (nationality()) {
          <app-country-flag [code]="nationality()" [compact]="true" />
        }
      </div>
      <div class="shrink-0 flex items-center">
        @switch (variant()) {
          @case ('following') {
            @if (isMutual()) {
              <span class="text-[11px] font-semibold py-0.5 px-2 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Mutual</span>
            }
          }
          @case ('visitors') {
            @if (visitTs(); as ts) {
              <span class="inline-flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                <svg aria-hidden="true" lucideUsers [size]="11" />
                {{ formatRelativeTime(ts) }}
                @if ((visitCnt() ?? 0) > 1) {
                  <span class="font-semibold">&times;{{ visitCnt() }}</span>
                }
              </span>
            }
          }
        }
      </div>
    </div>
  `,
})
export class UserListItemComponent {
  readonly userId = input.required<number>();
  readonly name = input.required<string>();
  readonly headUrl = input<string | null>(null);
  readonly nationality = input<string | null>(null);
  readonly vipType = input<number | null>(null);
  readonly variant = input.required<UserListItemVariant>();
  readonly isMutual = input(false);
  readonly visitTs = input<number | null>(null);
  readonly visitCnt = input<number | null>(null);

  readonly userClick = output<number>();

  readonly initials = computed(() => this.name().slice(0, 2));

  /** Template bridge: Angular templates can only call class members, not module-scope imports. */
  protected formatRelativeTime(ts: number): string {
    return relativeTime(ts);
  }
}
