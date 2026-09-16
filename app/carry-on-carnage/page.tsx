import CarryOnCarnageGame from '@/games/carry-on-carnage/Game';

export const metadata = {
  title: 'Carry-On Carnage — Jumbleyard',
  description:
    "1–4 desperate travelers pack an absurd mountain of vacation junk into carry-on suitcases, dogpile to compress springy bulging seams, and pass the gate agent's ruthless metal sizer box before the flight takes off!",
};

export default function Page() {
  return <CarryOnCarnageGame />;
}
