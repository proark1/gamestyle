import { getCatalog } from '@/games/first-person/audio/catalog';
import AudioAdmin from '@/shared/audio/construction/Admin';
export const metadata = { title: 'Brick by Hand sound workshop — Jumbleyard' };
export default function Page() {
  return (
    <AudioAdmin key="first-person" game="first-person" catalog={getCatalog()} />
  );
}
