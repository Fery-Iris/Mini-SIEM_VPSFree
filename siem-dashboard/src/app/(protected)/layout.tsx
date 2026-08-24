'use client';
import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { GoogleAuthHandler } from '@/components/GoogleAuthHandler';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  return <>{children}</>;
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex bg-[#070d1a] font-sans text-slate-300">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {/* Handle Google OAuth redirect: picks up ?token= params and stores to localStorage */}
      <Suspense fallback={null}>
        <GoogleAuthHandler />
      </Suspense>
      <AuthGuard>
        <LayoutInner>{children}</LayoutInner>
      </AuthGuard>
    </SidebarProvider>
  );
}
