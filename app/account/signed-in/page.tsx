import type { Metadata } from 'next';
import SignedInRelay, {
  type RelayResult,
} from '@/shared/accounts/SignedInRelay';

export const metadata: Metadata = {
  title: 'Signing in — Jumbleyard',
  robots: { index: false },
};

const RESULTS: RelayResult[] = ['ok', 'cancelled', 'failed', 'unavailable'];

export default async function SignedInPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { result } = await searchParams;
  return (
    <SignedInRelay
      result={RESULTS.find((known) => known === result) ?? 'failed'}
    />
  );
}
