/**
 * Centralized room permission checks — one place for predicates that combine more than one
 * piece of room state, so a future second call site doesn't reimplement the combination
 * (or reimplement it slightly differently). Kept as plain functions, not a class with static
 * methods, matching this feature's existing utils/ convention (buildKickedFromRoomOutcome,
 * resolveManagerIdentity, etc.) rather than introducing a new style for the same kind of code.
 */

/**
 * Hosts and moderators get the full moderation modal (mute/kick/ban etc.) for real users; a
 * plain viewer — or anyone clicking a ghost placeholder, which has no confirmed identity to
 * act on — gets the read-only profile card instead. See room-page-base.ts's openUserActions().
 */
export function canModerateUser(isHost: boolean, isModerator: boolean, isGhost: boolean): boolean {
  return (isHost || isModerator) && !isGhost;
}
