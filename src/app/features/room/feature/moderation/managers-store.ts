import { Injectable, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { RoomApi } from '../../data/room-api';
import { ManagerListResponse } from '../../data/room-model';
import { UserRole } from '@core/models/user-role';

const EMPTY_MANAGER_LIST: ManagerListResponse = { managerList: [] };

interface ManagersParams {
  readonly cname: string;
  readonly hostId: number;
}

@Injectable()
export class ManagersStore {
  private readonly api = inject(RoomApi);

  private readonly _cname = signal<string | null>(null);
  private readonly _hostId = signal<number | null>(null);

  private readonly managersRef = rxResource<ManagerListResponse, ManagersParams | undefined>({
    params: () => {
      const cname = this._cname();
      const hostId = this._hostId();
      return cname === null || hostId === null ? undefined : { cname, hostId };
    },
    stream: ({ params }) =>
      params === undefined ? of(EMPTY_MANAGER_LIST) : this.api.listManagers(params.cname, params.hostId),
    defaultValue: EMPTY_MANAGER_LIST,
  });

  readonly managers = computed(() => (this.managersRef.value().managerList ?? []).filter((m) => m.role === UserRole.Moderator));
  readonly loading = this.managersRef.isLoading;
  readonly error = computed(() => (this.managersRef.error() ? 'Failed to load managers' : null));

  setParams(cname: string, hostId: number): void {
    this._cname.set(cname);
    this._hostId.set(hostId);
  }

  reload(): void {
    this.managersRef.reload();
  }
}
