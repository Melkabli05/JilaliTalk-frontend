import { AudienceUser } from '../models/room-model';

export type ViewMode = 'grid' | 'list';

export interface LanguageGroup {
  readonly language: string;
  readonly flag: string;
  readonly users: AudienceUser[];
}
