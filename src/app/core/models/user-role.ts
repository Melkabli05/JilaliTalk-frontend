export const UserRole = {
  Host: 1,
  Moderator: 2,
  Normal: 3,
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
