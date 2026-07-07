import { describe, expect, it } from 'vitest';
import { canModerateUser } from './permission.rules';

describe('canModerateUser', () => {
  it('lets the host moderate a real user', () => {
    expect(canModerateUser(true, false, false)).toBe(true);
  });

  it('lets a moderator moderate a real user', () => {
    expect(canModerateUser(false, true, false)).toBe(true);
  });

  it('denies a plain viewer', () => {
    expect(canModerateUser(false, false, false)).toBe(false);
  });

  it('denies moderation of a ghost placeholder even for the host', () => {
    expect(canModerateUser(true, false, true)).toBe(false);
  });

  it('denies moderation of a ghost placeholder even for a moderator', () => {
    expect(canModerateUser(false, true, true)).toBe(false);
  });
});
