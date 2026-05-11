import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, FileText, Users, Settings, Shield, LogOut, Activity, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/utils/cn';

interface AdminLayoutProps { children: React.ReactNode; }

const navigation = [
  { name: 'Dashboard',   href: '/admin',          icon: LayoutDashboard },
  { name: 'System Logs', href: '/admin/logs',     icon: FileText },
  { name: 'Users',       href: '/admin/users',    icon: Users },
  { name: 'Settings',    href: '/admin/settings', icon: Settings },
];

// layoutId must be unique per sidebar instance to avoid Framer Motion conflicts
const NavLinks = ({
  onClick,
  pillId,
  pathname,
}: {
  onClick?: () => void;
  pillId: string;
  pathname: string;
}) => (
  <>
    {navigation.map(({ name, href, icon: Icon }) => {
      const active = pathname === href;
      return (
        <Link
          key={href}
          to={href}
          onClick={onClick}
          className={cn(
            'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold tracking-[-0.01em] transition-colors',
            active
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {active && (
            <motion.div
              layoutId={pillId}
              className="absolute inset-0 bg-primary rounded-xl"
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            />
          )}
          <Icon className="relative h-4 w-4 flex-shrink-0" />
          <span className="relative">{name}</span>
        </Link>
      );
    })}
  </>
);

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    // Outer wrapper: full viewport height, no overflow on the root
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* ── Top header — fixed height, never scrolls ── */}
      <header className="shrink-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted"
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <Link to="/admin" className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-display font-bold text-[15px] tracking-tight">Admin Panel</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-primary/10 rounded-full">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-primary tracking-wide">System Monitor</span>
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

      {/* ── Body row: sidebar + content, fills remaining height ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar — fixed height, only nav scrolls ── */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-background/50 overflow-hidden">
          {/* Nav scrolls independently */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
            <NavLinks pillId="desktop-pill" pathname={pathname} />
          </nav>
          <div className="shrink-0 p-3 border-t">
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

        {/* ── Main content — scrolls independently ── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-5 sm:py-7">
            {children}
          </div>
        </main>
      </div>

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
          {/* Different pillId so Framer Motion doesn't conflict with desktop */}
          <NavLinks
            pillId="mobile-pill"
            pathname={pathname}
            onClick={() => setMobileOpen(false)}
          />
        </nav>
        <div className="shrink-0 p-3 border-t">
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
    </div>
  );
};

export default AdminLayout;
