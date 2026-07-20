import { Service, InjectionToken, Signal, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { RoomApi } from '../api/room-api';
import { Manager, ManagerListResponse } from '../models/room-model';
import { UserRole } from '@core/models/user-role';

const EMPTY_MANAGER_LIST: ManagerListResponse = { managerList: [] };

interface ManagersParams {
  readonly cname: string;
  readonly hostId: number;
}

/** Read-only surface for managers-modal.ts's list rendering. */
export interface ManagersReader {
  readonly managers: Signal<readonly Manager[]>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
}

/** managers-modal.ts also needs setParams/reload (it drives its own params from
 *  dialog data and reloads after a mutation), unlike the other narrow consumers
 *  which are purely read-only. */
export interface ManagersWriter {
  setParams(cname: string, hostId: number): void;
  reload(): void;
}

export const MANAGERS_READER = new InjectionToken<ManagersReader>('MANAGERS_READER');
export const MANAGERS_WRITER = new InjectionToken<ManagersWriter>('MANAGERS_WRITER');

@Service({ autoProvided: false })
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
  readonly error = computed(() => (this.managersRef.error() ? 'Failed to load moderators' : null));

  setParams(cname: string, hostId: number): void {
    this._cname.set(cname);
    this._hostId.set(hostId);
  }

  reload(): void {
    this.managersRef.reload();
  }

  reset(): void {
    this._cname.set(null);
    this._hostId.set(null);
  }
}
