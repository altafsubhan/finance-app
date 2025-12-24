import Navbar from '@/components/Navbar';
import AuthGuard from '@/components/AuthGuard';

export default function BudgetsLayout({
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

