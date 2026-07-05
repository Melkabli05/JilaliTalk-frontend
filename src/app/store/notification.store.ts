import { Service, effect, inject, signal, computed } from '@angular/core';
import { StorageService } from '@core/services/storage.service';
import { bucketForTimestamp, DAY_BUCKET_LABELS } from '@shared/utils/day-bucket.util';
import type {
  AppNotification,
  NotificationFilter,
  NotificationGroup,
  NotificationType,
  UndoEntry,
} from '@shared/ui/notification-panel/notification.model';

export type { AppNotification, NotificationType, NotificationFilter, NotificationGroup, UndoEntry };

/** Minimal profile shape needed by enrichUserInfo() — duplicated rather than imported
 *  from UserInfoService so store/ doesn't reach sideways into core/. The actual consumer
 *  in app.config.ts adapts the real UserInfo to this shape. */
interface EnrichtedProfile {
  readonly userId: number;
  readonly nickname: string | null;
  readonly headUrl: string | null;
}

// v2: dropped pre-v2 records where a profile_visit notification's `message`
// was the raw numeric visitorUserId string (e.g. "169335562 visited your profile")
// because the upstream push payload omitted nickname. Those records can never
// be repaired retroactively (no profile push will fire for a historical visitor),
// so the cleanest fix is to invalidate them and let them re-accumulate correctly.
const STORAGE_KEY = 'jtl_notifications_v2';
const MAX_NOTIFICATIONS = 100;
const UNDO_WINDOW_MS = 8000;
const TOAST_PREVIEW_MS = 4000;

@Service()
export class NotificationStore {
  private readonly storage = inject(StorageService);

  private readonly _notifications = signal<AppNotification[]>(
    this.storage.get<AppNotification[]>(STORAGE_KEY) ?? [],
  );
  private readonly _isOpen = signal(false);
  private readonly _filter = signal<NotificationFilter>('all');
  private readonly _undoEntry = signal<UndoEntry | null>(null);
  private readonly _pendingToast = signal<AppNotification | null>(null);

  private undoTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly notifications = this._notifications.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly undoEntry = this._undoEntry.asReadonly();
  readonly pendingToast = this._pendingToast.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter(n => !n.read).length);
  readonly hasNotifications = computed(() => this._notifications().length > 0);

  readonly visibleItems = computed<readonly AppNotification[]>(() => {
    const hiddenId = this._undoEntry()?.notification.id;
    const filter = this._filter();
    return this._notifications().filter(n => {
      if (n.id === hiddenId) return false;
      if (filter === 'all') return true;
      if (filter === 'unread') return !n.read;
      return n.type === filter;
    });
  });

  readonly groupedItems = computed<readonly NotificationGroup[]>(() => {
    const now = Date.now();
    const buckets = new Map<NotificationGroup['bucket'], AppNotification[]>();
    for (const item of this.visibleItems()) {
      const bucket = bucketForTimestamp(item.timestamp, now);
      const existing = buckets.get(bucket);
      if (existing) existing.push(item);
      else buckets.set(bucket, [item]);
    }
    const order: NotificationGroup['bucket'][] = ['today', 'yesterday', 'this-week', 'earlier'];
    return order
      .filter(bucket => buckets.has(bucket))
      .map(bucket => ({ bucket, label: DAY_BUCKET_LABELS[bucket], items: buckets.get(bucket)! }));
  });

  readonly filterCounts = computed<Record<NotificationFilter, number>>(() => {
    const counts: Record<NotificationFilter, number> = {
      all: 0, unread: 0, info: 0, success: 0, warning: 0, error: 0,
    };
    for (const n of this._notifications()) {
      counts.all++;
      if (!n.read) counts.unread++;
      counts[n.type]++;
    }
    return counts;
  });

  constructor() {
    effect(() => {
      this.storage.set(STORAGE_KEY, this._notifications());
    });
  }

  toggle(): void { this._isOpen.update(open => !open); }
  open(): void { this._isOpen.set(true); }
  close(): void { this._isOpen.set(false); }

  setFilter(filter: NotificationFilter): void {
    this._filter.set(filter);
  }

  add(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    const full = this.buildNotification(notification);
    this._notifications.update(list => this.capNotifications([full, ...list]));
    this.maybeShowToast(full);
  }

  addUserEvent(params: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'userId' | 'avatarUrl' | 'nickname'> & {
    userId: number;
    avatarUrl?: string | null;
    nickname?: string | null;
  }): void {
    const full = this.buildNotification(params);
    this._notifications.update(list => this.capNotifications([full, ...list]));
    this.maybeShowToast(full);
  }

  /**
   * Patches every stored notification whose `userId` matches `profile.userId`, filling in
   * the freshly-resolved `nickname` and `avatarUrl`. Called from ImBootstrapService's
   * enrichment flush so that realtime pushes whose payload omits a nickname (notably
   * profile_visit, where the upstream may send only `visitorUserId`) still render with
   * a proper identity once the BFF's `POST /users/enrich-batch` returns the real profile.
   *
   * The static `message` text is NOT rewritten — it stays as whatever the realtime push
   * supplied ("Someone visited your profile"). That's a deliberate UX choice: the
   * notification row already renders the avatar + nickname, so a now-correct identity
   * appears even if the prose remains a placeholder, and we avoid maintaining a brittle
   * title→template registry in the store.
   */
  enrichUserInfo(profile: EnrichtedProfile): void {
    const nickname = profile.nickname?.trim() || null;
    const avatarUrl = profile.headUrl ?? null;
    let changed = false;
    this._notifications.update(list => {
      const next = list.map(n => {
        if (n.userId !== profile.userId) return n;
        const sameNick = (n.nickname ?? null) === nickname;
        const sameAvatar = (n.avatarUrl ?? null) === avatarUrl;
        if (sameNick && sameAvatar) return n;
        changed = true;
        return { ...n, nickname, avatarUrl };
      });
      return changed ? next : list;
    });
  }

  markAllRead(): void {
    this._notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  requestRemove(id: string): void {
    const notification = this._notifications().find(n => n.id === id);
    if (!notification) return;
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this._undoEntry.set({ notification, expiresAt: Date.now() + UNDO_WINDOW_MS });
    this.undoTimer = setTimeout(() => {
      this.remove(notification.id);
      this._undoEntry.set(null);
      this.undoTimer = null;
    }, UNDO_WINDOW_MS);
  }

  undoRemove(): void {
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
    this._undoEntry.set(null);
  }

  remove(id: string): void {
    this._notifications.update(list => list.filter(n => n.id !== id));
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this._pendingToast.set(null);
  }

  clear(): void {
    if (this.undoTimer) { clearTimeout(this.undoTimer); this.undoTimer = null; }
    if (this.toastTimer) { clearTimeout(this.toastTimer); this.toastTimer = null; }
    this._undoEntry.set(null);
    this._pendingToast.set(null);
    this._notifications.set([]);
    this.storage.remove(STORAGE_KEY);
  }

  private buildNotification(
    params: Omit<AppNotification, 'id' | 'timestamp' | 'read'>,
  ): AppNotification {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return { ...params, id, timestamp: Date.now(), read: false };
  }

  private capNotifications(list: AppNotification[]): AppNotification[] {
    return list.length > MAX_NOTIFICATIONS ? list.slice(0, MAX_NOTIFICATIONS) : list;
  }

  private maybeShowToast(notification: AppNotification): void {
    if (this._isOpen()) return;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this._pendingToast.set(notification);
    this.toastTimer = setTimeout(() => this.dismissToast(), TOAST_PREVIEW_MS);
  }
}
