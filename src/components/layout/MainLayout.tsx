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
      
      {/* Main Content */}
      <main
        className={cn(
          "pt-16 lg:pt-0 min-h-screen transition-all duration-300",
          isCollapsed ? "lg:ml-[80px]" : "lg:ml-[280px]"
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
