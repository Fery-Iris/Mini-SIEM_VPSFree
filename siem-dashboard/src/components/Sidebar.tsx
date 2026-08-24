'use client';
import type { FC } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  KeyRound,
  Radar,
  ShieldBan,
  Bell,
  LogOut,
  X,
  Globe,
} from 'lucide-react';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';

export const NAV_ITEMS = [
  { label: 'Monitoring',  icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Detection',   icon: Radar,            href: '/detection' },
  { label: 'Blocked IPs', icon: ShieldBan,        href: '/blocked' },
  { label: 'Threat Intel',icon: Globe,            href: '/threat-intel', isNew: true },
  { label: 'Alerts',      icon: Bell,             href: '/alerts' },
  { label: 'API Key',     icon: KeyRound,         href: '/apikey' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export const Sidebar: FC<SidebarProps> = ({ open, onClose, onLogout }) => {
  const { t } = useLanguage();
  const pathname = usePathname();

  const isActive = (href: string) => {
    // Exact match for /dashboard, prefix match for sub-routes
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const labelMap: Record<string, string> = {
    '/dashboard':           t('sidebar.dashboard') !== 'sidebar.dashboard' ? t('sidebar.dashboard') : 'Monitoring',
    '/dashboard/detection': t('sidebar.detectionPanel') !== 'sidebar.detectionPanel' ? t('sidebar.detectionPanel') : 'Detection',
    '/dashboard/blocked':   t('sidebar.blockedPanel') !== 'sidebar.blockedPanel' ? t('sidebar.blockedPanel') : 'Blocked IPs',
    '/dashboard/threat-intel': 'Threat Intel',
    '/dashboard/alerts':    'Alerts',
    '/dashboard/apikey':    t('sidebar.getApiKey') !== 'sidebar.getApiKey' ? t('sidebar.getApiKey') : 'API Key',
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col bg-[#070d1a] border-r border-slate-800/80 transition-transform duration-300 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 shrink-0 border-b border-slate-800/50">
          <img src="/logo-siem.png" alt="Mini-SIEM Logo" className="h-8 w-auto" />
          <span className="text-lg font-bold text-slate-100 tracking-tight whitespace-nowrap">
            MicroGaze
          </span>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle variant="dark" />
            <button
              className="lg:hidden text-slate-400 hover:text-slate-200"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const label = labelMap[item.href] || item.label;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all group ${
                  active
                    ? 'bg-blue-500/10 text-blue-400 shadow-sm shadow-blue-500/5 border border-blue-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <item.icon
                  size={18}
                  className={active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'}
                  strokeWidth={active ? 2.5 : 2}
                />
                {label}
                {item.isNew && (
                  <span className="ml-auto text-[9px] font-bold bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    NEW
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800/80">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20 group"
          >
            <LogOut size={18} strokeWidth={2} className="group-hover:translate-x-1 transition-transform" />
            {t('sidebar.logout') !== 'sidebar.logout' ? t('sidebar.logout') : 'Sign Out'}
          </button>
        </div>
      </aside>
    </>
  );
};
