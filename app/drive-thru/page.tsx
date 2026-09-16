import DriveThruGame from '@/games/drive-thru/Game';

export const metadata = {
  title: 'Drive-Thru Static — Jumbleyard',
  description:
    'Fast-food drive-thru slapstick chaos! Decipher scrambled intercom orders, flip burgers on a smoking grill, vent violent milkshake machines, and ragdoll reach across the curb gap!',
};

export default function Page() {
  return <DriveThruGame />;
}
