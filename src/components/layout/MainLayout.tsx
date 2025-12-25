import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { SidebarProvider, useSidebarContext } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

function MainContent({ children }: MainLayoutProps) {
  const { isCollapsed } = useSidebarContext();
  
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "pt-16 lg:pt-0 min-h-screen transition-all duration-300",
          isCollapsed ? "lg:ml-[80px]" : "lg:ml-[280px]"
        )}
      >
        {children}
      </motion.main>
    </div>
  );
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <MainContent>{children}</MainContent>
    </SidebarProvider>
  );
}
