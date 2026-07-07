import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { ChannelListItem } from '../../data/rooms-model';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { LucideEye, LucideEyeOff, LucideTrendingUp } from '@lucide/angular';

@Component({
  selector: 'app-recommended-room-card',
  imports: [AvatarComponent, ButtonComponent, CountryFlagComponent, LanguageTagComponent, LucideEye, LucideEyeOff, LucideTrendingUp],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recommended-room-card.html',
  styleUrl: './recommended-room-card.scss',
})
export class RecommendedRoomCardComponent {
  readonly room = input.required<ChannelListItem>();
  readonly joinRoom = output<{ room: ChannelListItem; visible: boolean }>();

  handleJoin(visible: boolean, event?: Event): void {
    event?.stopPropagation();
    this.joinRoom.emit({ room: this.room(), visible });
  }
}
