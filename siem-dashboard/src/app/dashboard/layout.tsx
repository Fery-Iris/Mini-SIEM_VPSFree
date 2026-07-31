export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020817] text-slate-50">
      {children}
    </div>
  );
}
