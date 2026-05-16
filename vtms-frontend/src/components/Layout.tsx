import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Users, BookOpen, ClipboardCheck, Package, DollarSign, Heart, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const NavigationItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx(
        'flex flex-col items-center p-2 text-xs font-medium transition-colors',
        isActive ? 'text-primary-600' : 'text-gray-500 hover:text-primary-500'
      )
    }
  >
    <Icon className="w-6 h-6 mb-1" />
    <span>{label}</span>
  </NavLink>
);

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-16 lg:pb-0 lg:pl-64">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r fixed left-0 top-0 h-full overflow-y-auto">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-primary-700">VTMS NGO</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavLink to="/" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
            <Home className="w-5 h-5" /> <span>Dashboard</span>
          </NavLink>
          <NavLink to="/batches" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
            <ClipboardCheck className="w-5 h-5" /> <span>Batches</span>
          </NavLink>
          <NavLink to="/trainees" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
            <Users className="w-5 h-5" /> <span>Trainees</span>
          </NavLink>
          <NavLink to="/attendance" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
            <BookOpen className="w-5 h-5" /> <span>Attendance</span>
          </NavLink>
          <NavLink to="/case-management" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
            <Heart className="w-5 h-5" /> <span>Case Management</span>
          </NavLink>
          <NavLink to="/inventory" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
            <Package className="w-5 h-5" /> <span>Inventory</span>
          </NavLink>
          <NavLink to="/financials" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100">
            <DollarSign className="w-5 h-5" /> <span>Financials</span>
          </NavLink>
        </nav>
      </aside>

      {/* Header */}
      <header className="bg-white shadow-sm h-16 flex items-center px-4 sticky top-0 z-10 lg:hidden">
        <h1 className="text-lg font-bold text-primary-700">VTMS</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8">
        <Outlet />
      </main>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center h-16 z-20">
        <NavigationItem to="/" icon={Home} label="Home" />
        <NavigationItem to="/trainees" icon={Users} label="Trainees" />
        <NavigationItem to="/attendance" icon={BookOpen} label="Log" />
        <NavigationItem to="/case-management" icon={Heart} label="Care" />
        <NavigationItem to="/more" icon={Settings} label="More" />
      </nav>
    </div>
  );
};

export default Layout;
