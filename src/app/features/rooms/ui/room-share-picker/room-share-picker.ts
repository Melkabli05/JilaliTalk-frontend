import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { from, of } from 'rxjs';
import { UserPickerSheetComponent } from '@shared/ui/user-picker-sheet/user-picker-sheet';
import type { UserPickerTab, UserSummary } from '@shared/ui/user-picker-sheet/user-picker-sheet.model';
import { asNumericPeerId } from '@shared/utils';
import { AuthStore } from '@core/auth/auth.store';
import { HtImConnectionService } from '@core/realtime/ht-im-connection.service';
import { ToastService } from '@core/services/toast.service';
import { BusiType, type ChannelListItem } from '../../data/rooms-model';
import { RoomShareDirectory } from '../../data/room-share-directory';

const FOLLOWING_LIMIT = 50;
const FOLLOWERS_LIMIT = 50;

/**
 * Self-contained "share this room with a user" flow: a room-list page drops this in once
 * and drives it with two inputs (open, room) — everything else (directory fetching, tab
 * state, by-ID lookup, sending the DM) is owned here. Sends via HtImConnectionService
 * directly (core/realtime, reachable by any feature) rather than through ChatStore, since
 * features/rooms can't import features/chat — and separately records an outbound-echo
 * (HtImConnectionService.recordOutboundRoomShareEcho) so the chat feature's conversation
 * list still reflects the share, without this component needing any knowledge of ChatStore.
 */
@Component({
  selector: 'app-room-share-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UserPickerSheetComponent],
  template: `
    <app-user-picker-sheet
      [open]="open()"
      title="Share room with"
      [tab]="tab()"
      [users]="pickerUsers()"
      [byIdView]="byIdResult()"
      [loading]="pickerLoading()"
      [error]="pickerError()"
      [emptyCopy]="emptyCopy()"
      [byIdQuery]="byIdQuery()"
      [byIdValid]="byIdValid()"
      (close)="closed.emit()"
      (tabChange)="tab.set($event)"
      (pick)="onPick($event)"
      (submitById)="byIdSubmitted.set(byIdQuery())"
      (byIdQueryChange)="byIdQuery.set($event)"
    />
  `,
})
export class RoomSharePickerComponent {
  readonly open = input<boolean>(false);
  readonly room = input<ChannelListItem | null>(null);
  readonly closed = output<void>();

  private readonly authStore = inject(AuthStore);
  private readonly directory = inject(RoomShareDirectory);
  private readonly im = inject(HtImConnectionService);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<UserPickerTab>('following');
  protected readonly byIdQuery = signal('');
  protected readonly byIdSubmitted = signal('');

  protected readonly byIdValid = computed(() => /^\d+$/.test(this.byIdQuery().trim()));

  private readonly followingRes = rxResource<readonly UserSummary[], boolean | undefined>({
    params: () => (this.open() && this.tab() === 'following' ? true : undefined),
    stream: ({ params }) => params === undefined ? of([]) : from(this.directory.following(FOLLOWING_LIMIT).then((p) => p.list)),
    defaultValue: [],
  });

  private readonly followersRes = rxResource<readonly UserSummary[], boolean | undefined>({
    params: () => (this.open() && this.tab() === 'followers' ? true : undefined),
    stream: ({ params }) => params === undefined ? of([]) : from(this.directory.followers(1, FOLLOWERS_LIMIT).then((p) => p.list)),
    defaultValue: [],
  });

  private readonly visitorsRes = rxResource<readonly UserSummary[], boolean | undefined>({
    params: () => (this.open() && this.tab() === 'visitors' ? true : undefined),
    stream: ({ params }) => params === undefined ? of([]) : from(this.directory.visitors(1).then((p) => p.list)),
    defaultValue: [],
  });

  private readonly byIdRes = rxResource<UserSummary | null, number | undefined>({
    params: () => (this.byIdValid() && this.byIdSubmitted() ? Number(this.byIdSubmitted()) : undefined),
    stream: ({ params }) => params === undefined ? of(null) : from(this.directory.byId(params)),
    defaultValue: null,
  });

  protected readonly pickerUsers = computed<readonly UserSummary[]>(() => {
    switch (this.tab()) {
      case 'following': return this.followingRes.value();
      case 'followers': return this.followersRes.value();
      case 'visitors': return this.visitorsRes.value();
      default: return [];
    }
  });

  protected readonly byIdResult = computed(() => (this.tab() === 'byId' ? this.byIdRes.value() : null));

  protected readonly pickerLoading = computed(() => {
    switch (this.tab()) {
      case 'following': return this.followingRes.isLoading();
      case 'followers': return this.followersRes.isLoading();
      case 'visitors': return this.visitorsRes.isLoading();
      case 'byId': return this.byIdRes.isLoading();
    }
  });

  protected readonly pickerError = computed(() => {
    const tab = this.tab();
    const res = tab === 'following' ? this.followingRes
      : tab === 'followers' ? this.followersRes
      : tab === 'visitors' ? this.visitorsRes
      : this.byIdRes;
    if (!res.error()) return null;
    switch (tab) {
      case 'following': return 'Failed to load following.';
      case 'followers': return 'Failed to load followers.';
      case 'visitors': return 'Failed to load visitors.';
      default: return 'Search failed. Try again.';
    }
  });

  protected readonly emptyCopy = computed(() => {
    switch (this.tab()) {
      case 'following': return "You're not following anyone yet.";
      case 'followers': return 'No followers yet.';
      case 'visitors': return 'No visitors yet.';
      default: return 'Enter a user ID to search.';
    }
  });

  protected onPick(user: UserSummary): void {
    const room = this.room();
    if (!room) return;
    const peerId = asNumericPeerId(user.userId);
    if (!Number.isFinite(peerId)) return;
    const me = this.authStore.user();
    if (!me) return;
    const cname = room.channel.cname;
    const isVoice = room.channel.busiType === BusiType.Voice;
    const msgId = crypto.randomUUID();
    const ts = Date.now();
    this.im.sendDm(
      peerId,
      isVoice ? { kind: 'voice_room', roomData: { cname } } : { kind: 'live_link', roomData: { cname } },
      me.nickname,
      ts,
      msgId,
    );
    // sendDm alone doesn't touch the chat feature's conversation list (see this component's
    // doc comment) — record the echo so ChatStore reflects it the same way its own
    // sendVoiceRoom/sendLiveLink methods would if this had been sent from the chat composer.
    this.im.recordOutboundRoomShareEcho({
      peerId,
      msgId,
      kind: isVoice ? 'voice_room' : 'live_link',
      cname,
      fromNickname: me.nickname,
      ts,
    });
    this.toast.success(`Shared with ${user.nickname}`);
    this.closed.emit();
  }
}
