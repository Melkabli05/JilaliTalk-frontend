import { DestroyRef, WritableSignal } from '@angular/core';
import { EMPTY } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomApi } from '../api/room-api';
import { ToastService } from '@core/services/toast.service';
import { AudienceUser } from '../models/room-model';

export function inviteToStage(
  user: AudienceUser,
  cname: string | null,
  busiType: number,
  api: RoomApi,
  toast: ToastService,
  inviteBusy: WritableSignal<number | null>,
  destroyRef: DestroyRef,
): void {
  if (!cname || inviteBusy() !== null) return;
  inviteBusy.set(user.userId);

  api.inviteToStage(cname, busiType, user.userId).pipe(
    takeUntilDestroyed(destroyRef),
    tap({
      next: () => toast.success(`Invited ${user.base?.nickname ?? 'user'} to stage`),
      error: () => toast.error('Failed to invite to stage'),
    }),
    catchError(() => EMPTY),
  ).subscribe({ complete: () => inviteBusy.set(null) });
}
