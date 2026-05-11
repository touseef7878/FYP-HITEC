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
  { path: "/",            label: "Home",            icon: Home },
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
  <NavLink to={path} onClick={onClose} className="block relative">
    {isActive && (
      <motion.div
        layoutId="sidebar-active-pill"
        className="absolute inset-0 bg-primary/12 rounded-xl border border-primary/20"
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      />
    )}
    <div className={cn(
      "relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer",
      "hover:bg-muted/60",
      isActive && "text-primary",
      isCollapsed && "justify-center px-0"
    )}>
      <Icon className={cn(
        "h-[18px] w-[18px] flex-shrink-0",
        isActive ? "text-primary" : "text-muted-foreground"
      )} />
      {!isCollapsed && (
        <span className={cn(
          "text-[13.5px] font-semibold truncate tracking-[-0.01em]",
          isActive ? "text-primary" : "text-foreground/80"
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

  const closeMobile  = useCallback(() => setIsMobileOpen(false), [setIsMobileOpen]);
  const toggleMobile = useCallback(() => setIsMobileOpen(v => !v), [setIsMobileOpen]);
  const toggleCollapse = useCallback(() => setIsCollapsed(v => !v), [setIsCollapsed]);

  // ── Shared inner content ──────────────────────────────────────────────
  const SidebarContent = (
    <>
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 border-b border-sidebar-border flex-shrink-0",
        isCollapsed ? "px-0 py-5 justify-center" : "px-4 py-5"
      )}>
        <img src={logoImg} alt="OceanGuard AI" className="w-9 h-9 rounded-xl flex-shrink-0" />
        {!isCollapsed && (
          <div className="overflow-hidden min-w-0">
            <h1 className="font-display font-bold text-[15px] whitespace-nowrap gradient-text">OceanGuard AI</h1>
            <p className="text-[11px] text-muted-foreground whitespace-nowrap font-medium tracking-wide">Marine Plastic Detection</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn(
        "flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden",
        isCollapsed ? "px-2" : "px-3"
      )}>
        {navItems.map(item => (
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
            : <Sun  className="h-4 w-4 flex-shrink-0" />}
          {!isCollapsed && (theme === "light" ? "Dark Mode" : "Light Mode")}
        </Button>

        <Button
          variant="ghost" size="icon"
          className="w-full hidden lg:flex justify-center h-9"
          onClick={toggleCollapse}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile hamburger ── */}
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>

      {/*
        ── DESKTOP sidebar — sticky ──────────────────────────────────────
        `sticky top-0 h-screen` means:
          • The sidebar column starts at the top of the page
          • As you scroll, it sticks to the top of the VIEWPORT
          • The content column next to it scrolls freely
          • This is the correct "always-visible sidebar" pattern
          • It does NOT block scrolling — the page scrolls normally
      */}
      <aside
        className={cn(
          "hidden lg:flex flex-col flex-shrink-0",
          "sticky top-0 self-start",          // sticks to viewport top while content scrolls
          "bg-sidebar border-r border-sidebar-border",
          "transition-[width] duration-200 ease-out overflow-hidden",
          isCollapsed ? "w-20" : "w-[280px]"
        )}
        style={{ height: "100dvh" }}
      >
        {SidebarContent}
      </aside>

      {/*
        ── MOBILE sidebar — fixed overlay ───────────────────────────────
        On mobile the sidebar slides in as a full-screen overlay.
        Completely separate from the desktop sidebar above.
      */}
      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 z-40 flex flex-col w-[280px]",
          "bg-sidebar border-r border-sidebar-border overflow-hidden",
          "transition-transform duration-200 ease-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ height: "100dvh" }}
      >
        {SidebarContent}
      </aside>
    </>
  );
});
Sidebar.displayName = "Sidebar";
