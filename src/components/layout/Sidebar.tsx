import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { memo, useCallback, useMemo } from "react";
import {
  Home,
  Upload,
  BarChart3,
  History,
  Map,
  TrendingUp,
  FileText,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useSidebarContext } from "@/hooks/useSidebar";
import { cn } from "@/utils/cn";
import logoImg from "@/assets/images/marine-logo.png";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/upload", label: "Upload & Detect", icon: Upload },
  { path: "/dashboard", label: "Analytics", icon: BarChart3 },
  { path: "/history", label: "History", icon: History },
  { path: "/heatmap", label: "Pollution Map", icon: Map },
  { path: "/predictions", label: "Predictions", icon: TrendingUp },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

export const Sidebar = memo(() => {
  const { isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen } = useSidebarContext();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Memoize the mobile close handler to prevent unnecessary re-renders
  const handleMobileClose = useCallback(() => {
    setIsMobileOpen(false);
  }, [setIsMobileOpen]);

  // Memoize the collapse toggle handler
  const handleCollapseToggle = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed, setIsCollapsed]);

  // Memoize the mobile menu toggle handler
  const handleMobileToggle = useCallback(() => {
    setIsMobileOpen(!isMobileOpen);
  }, [isMobileOpen, setIsMobileOpen]);

  // Memoize sidebar variants to prevent recreation on every render
  const sidebarVariants = useMemo(() => ({
    expanded: { width: 280 },
    collapsed: { width: 80 },
  }), []);

  // Memoize current path to prevent unnecessary re-renders
  const currentPath = location.pathname;

// Memoized NavItem component to prevent unnecessary re-renders
const NavItem = memo(({ path, label, icon: Icon, isActive, isCollapsed, onMobileClose }: {
  path: string;
  label: string;
  icon: any;
  isActive: boolean;
  isCollapsed: boolean;
  onMobileClose: () => void;
}) => {
  return (
    <NavLink to={path} onClick={onMobileClose}>
      <motion.div
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
          "hover:bg-accent/10 group cursor-pointer",
          isActive && "bg-primary/10 text-primary border-r-2 border-primary"
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 flex-shrink-0 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
          )}
        />
        {!isCollapsed && (
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap overflow-hidden",
              isActive ? "text-primary" : "text-foreground"
            )}
          >
            {label}
          </span>
        )}
      </motion.div>
    </NavLink>
  );
});

NavItem.displayName = 'NavItem';

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={handleMobileToggle}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={handleMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border z-40",
          "flex flex-col",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ transition: 'width 0.3s ease-in-out' }}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
          <div className="flex-shrink-0">
            <img src={logoImg} alt="OceanGuard AI" className="w-10 h-10 rounded-xl" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg whitespace-nowrap gradient-text">
                OceanGuard AI
              </h1>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                Marine Plastic Detection
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem 
              key={item.path} 
              {...item} 
              isActive={currentPath === item.path}
              isCollapsed={isCollapsed}
              onMobileClose={handleMobileClose}
            />
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-sidebar-border space-y-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3",
              isCollapsed && "justify-center px-0"
            )}
            onClick={toggleTheme}
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
            {!isCollapsed && (
              <span className="text-sm">
                {theme === "light" ? "Dark Mode" : "Light Mode"}
              </span>
            )}
          </Button>

          {/* Collapse Toggle (Desktop) */}
          <Button
            variant="ghost"
            size="icon"
            className="w-full hidden lg:flex justify-center"
            onClick={handleCollapseToggle}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>
      </motion.aside>
    </>
  );
});
Sidebar.displayName = 'Sidebar';