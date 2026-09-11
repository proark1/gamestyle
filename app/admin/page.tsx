import AdminHub from '@/platform/admin/AdminHub';

export const metadata = {
  title: 'Admin — Jumbleyard',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AdminHub />;
}
