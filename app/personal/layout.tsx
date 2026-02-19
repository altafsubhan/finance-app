import Navbar from '@/components/Navbar';
import AuthGuard from '@/components/AuthGuard';

export default function PersonalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <Navbar />
      {children}
    </AuthGuard>
  );
}
