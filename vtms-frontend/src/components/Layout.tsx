import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, ClipboardList, Package,
  DollarSign, Heart, GraduationCap, UserCheck, Menu, X, Layers,
  LogOut, ShieldCheck, Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canView, type Domain } from '../lib/permissions';

const NAV_ITEMS: { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean; domain?: Domain }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/batches', icon: Layers, label: 'Batches', domain: 'batches' },
  { to: '/trainees', icon: Users, label: 'Trainees', domain: 'trainees' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance', domain: 'attendance' },
  { to: '/competency', icon: BookOpen, label: 'Competency', domain: 'competency' },
  { to: '/case-management', icon: Heart, label: 'Case Mgmt', domain: 'case_notes' },
  { to: '/inventory', icon: Package, label: 'Inventory', domain: 'inventory' },
  { to: '/financials', icon: DollarSign, label: 'Financials', domain: 'financials' },
  { to: '/graduation', icon: GraduationCap, label: 'Graduation', domain: 'graduation' },
  { to: '/alumni', icon: UserCheck, label: 'Alumni', domain: 'alumni' },
];

const MOBILE_NAV: { to: string; icon: typeof LayoutDashboard; label: string; domain?: Domain }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/trainees', icon: Users, label: 'Trainees', domain: 'trainees' },
  { to: '/attendance', icon: ClipboardList, label: 'Log', domain: 'attendance' },
  { to: '/case-management', icon: Heart, label: 'Care', domain: 'case_notes' },
  { to: '/more', icon: Menu, label: 'More' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { batches, activeBatchId, setActiveBatch, dataLoaded } = useStore();
  const { profile, signOut } = useAuth();
  const activeBatch = batches.find((b) => b.id === activeBatchId);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.domain || (profile && canView(profile.role, item.domain))
  );
  const navItems = profile?.role === 'admin'
    ? [...visibleNavItems, { to: '/admin/staff', icon: ShieldCheck, label: 'Staff' }]
    : visibleNavItems;

  const visibleMobileNav = MOBILE_NAV.filter(
    (item) => !item.domain || (profile && canView(profile.role, item.domain))
  );

  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 z-40 flex flex-col transition-transform duration-200',
        'lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Agape Skills Centre</p>
            <h1 className="text-base font-bold text-primary-700 leading-tight">VTMS</h1>
          </div>
          <button className="lg:hidden p-1" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Active batch selector */}
        <div className="px-4 py-3 border-b border-gray-100 bg-primary-50">
          <p className="text-[10px] text-primary-600 uppercase font-semibold mb-1">Active Batch</p>
          <select
            value={activeBatchId}
            onChange={(e) => setActiveBatch(e.target.value)}
            className="w-full text-xs font-semibold text-primary-800 bg-transparent border-0 outline-none cursor-pointer"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {activeBatch && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold mt-1 inline-block',
              activeBatch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            )}>
              {activeBatch.status.toUpperCase()}
            </span>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center space-x-2 px-2">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
              {profile ? profile.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : ''}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{profile?.fullName}</p>
              <p className="text-[10px] text-gray-400 capitalize">{profile?.role.replace('_', ' ')}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center px-4 gap-3">
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {NAV_ITEMS.find((n) =>
                n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
              )?.label ?? 'VTMS'}
            </p>
            <p className="text-[11px] text-gray-400 truncate hidden sm:block">
              {activeBatch?.name} · {activeBatch?.trade}
            </p>
          </div>
          <span className={cn(
            'hidden sm:flex items-center space-x-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full',
            'bg-green-100 text-green-700'
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span>Online</span>
          </span>
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 z-20 px-2">
        {visibleMobileNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              'flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition-colors min-w-0',
              isActive ? 'text-primary-600' : 'text-gray-400'
            )}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
