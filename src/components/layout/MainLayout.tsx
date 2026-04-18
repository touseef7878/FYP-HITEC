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
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main
        className={cn(
          "min-h-screen transition-[margin] duration-300",
          /* mobile: shift down just enough for the hamburger (56px = h-14) */
          "pt-14 lg:pt-0",
          /* desktop: shift right based on sidebar width */
          isCollapsed ? "lg:ml-20" : "lg:ml-[280px]"
        )}
      >
        {children}
      </main>
    </div>
  );
});

MainContent.displayName = 'MainContent';

export const MainLayout = memo(({ children }: MainLayoutProps) => {
  return (
    <SidebarProvider>
      <MainContent>{children}</MainContent>
    </SidebarProvider>
  );
});

MainLayout.displayName = 'MainLayout';
