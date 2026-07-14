import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, ClipboardList, Package,
  DollarSign, Heart, GraduationCap, UserCheck, Menu, X, Layers,
  LogOut, ShieldCheck, Wrench,
} from 'lucide-react';
import { cn, formatBatchTrades } from '../lib/utils';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canView, type Domain } from '../lib/permissions';
import Brand from './Brand';
import ThemeToggle from './ThemeToggle';
import Preloader from './Preloader';

const NAV_ITEMS: { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean; domain?: Domain }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/batches', icon: Layers, label: 'Batches', domain: 'batches' },
  { to: '/trainers', icon: Wrench, label: 'Trainers', domain: 'batches' },
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

  const currentLabel = NAV_ITEMS.find((n) =>
    n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
  )?.label ?? 'Dashboard';

  const initials = profile
    ? profile.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '';

  if (!dataLoaded) return <Preloader />;

  return (
    <div className="min-h-screen flex">
      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 z-40 flex flex-col transition-transform duration-200',
        'lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <Brand size="sm" className="min-w-0" />
          <button className="lg:hidden p-1 shrink-0" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Active batch selector */}
        <div className="px-4 py-3 border-b border-gray-100 bg-primary-50">
          <p className="text-[10px] text-primary-600 uppercase tracking-wider font-semibold mb-1">Active Batch</p>
          {batches.length === 0 ? (
            <p className="text-xs text-gray-500">No batches yet</p>
          ) : (
            <>
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
            </>
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
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    'h-4 w-0.5 rounded-full -ml-1 transition-colors',
                    isActive ? 'bg-primary-500' : 'bg-transparent'
                  )} />
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{profile?.fullName}</p>
              <p className="text-[10px] text-gray-400 capitalize">{profile?.role.replace('_', ' ')}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100 h-14 flex items-center px-4 gap-3">
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-base font-semibold text-gray-900 truncate leading-tight">
              {currentLabel}
            </h1>
            {activeBatch && (
              <p className="text-[11px] text-gray-400 truncate hidden sm:block">
                {activeBatch.name} · {formatBatchTrades(activeBatch.trades)}
              </p>
            )}
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 flex justify-around items-center h-16 z-20 px-2">
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
