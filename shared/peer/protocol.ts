/** Increment when wire semantics change. Rules revisions are independent per game. */
export const PEER_PROTOCOL = 2;
export const CHECKPOINT_SCHEMA = 1;
export const rulesVersion = (game: string) =>
  game === 'cage-clash' ? 2 : game === 'on-the-ropes' ? 3 : 1;
export const compatibility = (game: string) => ({
  protocol: PEER_PROTOCOL,
  rules: rulesVersion(game),
});
