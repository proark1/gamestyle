import { getCatalog } from '@/games/chaos/audio/catalog';
import AudioAdmin from '@/shared/audio/construction/Admin';
export const metadata = { title: 'Permit Pending sound workshop — Jumbleyard' };
export default function Page() {
  return <AudioAdmin key="chaos" game="chaos" catalog={getCatalog()} />;
}
