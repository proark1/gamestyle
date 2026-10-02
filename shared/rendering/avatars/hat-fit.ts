/** Nico's fringe ends below these seats, in head-local coordinates. */
export function nicoHatSeat(hat: string | boolean): number {
  switch (hat) {
    case 'party-cone':
      return 0.61;
    case 'bobble-beanie':
      return 0.58;
    case 'viking-helmet':
      return 0.57;
    case 'skipper-cap':
      return 0.465;
    default:
      return 0.55;
  }
}
