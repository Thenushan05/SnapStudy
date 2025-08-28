import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { StickyDrawer } from "@/components/sticky/StickyDrawer";
import { cn } from "@/lib/utils";


export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stickyOpen, setStickyOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <div className="min-h-screen flex w-full gradient-bg overflow-x-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col relative pt-14 sm:pt-16 overflow-x-hidden">
          <AppHeader onOpenSticky={() => setStickyOpen(true)} />
          
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>

          <StickyDrawer open={stickyOpen} onClose={() => setStickyOpen(false)} />
        </div>

      </div>
    </SidebarProvider>
  );
}