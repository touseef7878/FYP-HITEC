import { ReactNode, memo } from "react";
import { Sidebar } from "./Sidebar";
import { SidebarProvider, useSidebarContext } from "@/hooks/useSidebar";
import { cn } from "@/utils/cn";

interface MainLayoutProps {
  children: ReactNode;
}

const MainContent = memo(({ children }: MainLayoutProps) => {
  const { isCollapsed } = useSidebarContext();

  return (
    /**
     * Layout strategy:
     * - The outer div is a flex row that fills the full page height
     * - Sidebar is `sticky top-0 h-screen` — it sticks to the top of the
     *   viewport while the CONTENT column scrolls independently
     * - This means: sidebar always visible, content scrolls freely
     * - On mobile: sidebar is a fixed overlay (hamburger menu)
     */
    <div className="flex bg-background min-h-screen">
      <Sidebar />

      {/* Main content column — this is what scrolls */}
      <main
        className={cn(
          "flex-1 min-w-0",
          // Mobile: push content down past the hamburger button
          "pt-14 lg:pt-0"
        )}
      >
        {children}
      </main>
    </div>
  );
});

MainContent.displayName = "MainContent";

export const MainLayout = memo(({ children }: MainLayoutProps) => (
  <SidebarProvider>
    <MainContent>{children}</MainContent>
  </SidebarProvider>
));

MainLayout.displayName = "MainLayout";
