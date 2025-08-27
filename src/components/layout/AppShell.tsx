import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { StickyDrawer } from "@/components/sticky/StickyDrawer";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stickyOpen, setStickyOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <div className="min-h-screen flex w-full gradient-bg">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col relative pt-14 sm:pt-16">
          <AppHeader onOpenSticky={() => setStickyOpen(true)} />
          
          <main className="flex-1 overflow-hidden">
            {children}
          </main>

          <StickyDrawer open={stickyOpen} onClose={() => setStickyOpen(false)} />
        </div>

      </div>
    </SidebarProvider>
  );
}