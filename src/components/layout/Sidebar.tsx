import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useCallback } from "react";
import {
  Home, Upload, BarChart3, History, Map,
  TrendingUp, FileText, Settings, Menu, X, Sun, Moon,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useSidebarContext } from "@/hooks/useSidebar";
import { cn } from "@/utils/cn";
import logoImg from "@/assets/images/marine-logo.png";

const navItems = [
  { path: "/",            label: "Home",           icon: Home },
  { path: "/upload",      label: "Upload & Detect", icon: Upload },
  { path: "/dashboard",   label: "Analytics",       icon: BarChart3 },
  { path: "/history",     label: "History",         icon: History },
  { path: "/heatmap",     label: "Pollution Map",   icon: Map },
  { path: "/predictions", label: "Predictions",     icon: TrendingUp },
  { path: "/reports",     label: "Reports",         icon: FileText },
  { path: "/settings",    label: "Settings",        icon: Settings },
];

// ── NavItem ───────────────────────────────────────────────────────────────
const NavItem = memo(({ path, label, icon: Icon, isActive, isCollapsed, onClose }: {
  path: string; label: string; icon: any;
  isActive: boolean; isCollapsed: boolean; onClose: () => void;
}) => (
  <NavLink to={path} onClick={onClose} className="block">
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer",
        "hover:bg-accent/10",
        isActive && "bg-primary/10 text-primary border-r-2 border-primary",
        isCollapsed && "justify-center px-0"
      )}
    >
      <Icon className={cn(
        "h-5 w-5 flex-shrink-0",
        isActive ? "text-primary" : "text-muted-foreground"
      )} />
      {!isCollapsed && (
        <span className={cn(
          "text-sm font-medium truncate",
          isActive ? "text-primary" : "text-foreground"
        )}>
          {label}
        </span>
      )}
    </div>
  </NavLink>
));
NavItem.displayName = "NavItem";

// ── Sidebar ───────────────────────────────────────────────────────────────
export const Sidebar = memo(() => {
  const { isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen } = useSidebarContext();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();

  const closeMobile = useCallback(() => setIsMobileOpen(false), [setIsMobileOpen]);
  const toggleMobile = useCallback(() => setIsMobileOpen(v => !v), [setIsMobileOpen]);
  const toggleCollapse = useCallback(() => setIsCollapsed(v => !v), [setIsCollapsed]);

  return (
    <>
      {/* ── Mobile hamburger — floating pill, doesn't affect layout ── */}
      <button
        className="fixed top-3 left-3 z-50 lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-background/90 border border-border shadow-sm backdrop-blur-sm"
        onClick={toggleMobile}
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* ── Mobile backdrop ── */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar panel ── */}
      {/* 
        Desktop: always visible, width controlled by CSS variable.
        Mobile: slides in/out via translate.
        Using CSS transition (not framer-motion) for width — avoids layout reflow jank.
      */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen z-40 flex flex-col",
          "bg-sidebar border-r border-sidebar-border",
          /* CSS width transition — GPU composited, no layout reflow */
          "transition-[width] duration-200 ease-out overflow-hidden",
          /* Desktop width */
          isCollapsed ? "lg:w-20" : "lg:w-[280px]",
          /* Mobile: always full width when open, hidden when closed */
          "w-[280px]",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ transition: "width 200ms ease-out, transform 200ms ease-out" }}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 border-b border-sidebar-border flex-shrink-0",
          isCollapsed ? "px-0 py-5 justify-center" : "px-4 py-5"
        )}>
          <img src={logoImg} alt="OceanGuard AI" className="w-9 h-9 rounded-xl flex-shrink-0" />
          {!isCollapsed && (
            <div className="overflow-hidden min-w-0">
              <h1 className="font-bold text-base whitespace-nowrap gradient-text">OceanGuard AI</h1>
              <p className="text-xs text-muted-foreground whitespace-nowrap">Marine Plastic Detection</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={cn(
          "flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden",
          isCollapsed ? "px-2" : "px-3"
        )}>
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              {...item}
              isActive={pathname === item.path}
              isCollapsed={isCollapsed}
              onClose={closeMobile}
            />
          ))}
        </nav>

        {/* Bottom */}
        <div className={cn(
          "border-t border-sidebar-border flex-shrink-0 space-y-1",
          isCollapsed ? "p-2" : "p-3"
        )}>
          {/* Theme */}
          <Button
            variant="ghost"
            className={cn(
              "w-full gap-3 text-sm",
              isCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : "justify-start"
            )}
            onClick={toggleTheme}
          >
            {theme === "light"
              ? <Moon className="h-4 w-4 flex-shrink-0" />
              : <Sun className="h-4 w-4 flex-shrink-0" />}
            {!isCollapsed && (theme === "light" ? "Dark Mode" : "Light Mode")}
          </Button>

          {/* Collapse (desktop only) */}
          <Button
            variant="ghost"
            size="icon"
            className="w-full hidden lg:flex justify-center h-9"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>
    </>
  );
});
Sidebar.displayName = "Sidebar";
