export type UserPickerTab = 'following' | 'followers' | 'visitors' | 'byId';

export interface UserSummary {
  readonly userId: string;
  readonly nickname: string;
  readonly headUrl: string | null;
  readonly nationality?: string | null;
  readonly isMutual?: boolean;
}
