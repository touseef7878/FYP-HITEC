import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, Settings, Shield, LogOut, Activity, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/utils/cn';

interface AdminLayoutProps { children: React.ReactNode; }

const navigation = [
  { name: 'Dashboard',    href: '/admin',          icon: LayoutDashboard },
  { name: 'System Logs',  href: '/admin/logs',     icon: FileText },
  { name: 'Users',        href: '/admin/users',    icon: Users },
  { name: 'Settings',     href: '/admin/settings', icon: Settings },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navigation.map(({ name, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            to={href}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top header ── */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Left */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted"
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <Link to="/admin" className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-bold text-base">Admin Panel</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-primary/10 rounded-full">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">System Monitor</span>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{user?.username}</span>
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                {user?.role}
              </span>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      <div className={cn(
        'fixed top-14 left-0 bottom-0 z-40 w-64 bg-background border-r flex flex-col transition-transform duration-200 md:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLinks onClick={() => setMobileOpen(false)} />
        </nav>
        <div className="p-3 border-t">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-primary/5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* ── Desktop sidebar ── */}
        <aside className="hidden md:flex w-56 flex-col fixed top-14 bottom-0 z-30 border-r bg-background/50">
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <NavLinks />
          </nav>
          <div className="p-3 border-t">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-primary/5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{user?.username}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 md:pl-56 min-h-[calc(100vh-3.5rem)]">
          <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-5 sm:py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
