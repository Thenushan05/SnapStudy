import { MessageSquare, History, BrainCircuit, Map, BookOpen, Settings, Plus, CalendarDays, StickyNote } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navigation = [
  { 
    title: "New Chat", 
    url: "/", 
    icon: MessageSquare,
    isNew: true 
  },
  { 
    title: "History", 
    url: "/history", 
    icon: History 
  },
  { 
    title: "Quiz", 
    url: "/quiz", 
    icon: BrainCircuit 
  },
  { 
    title: "Mind Map", 
    url: "/mindmap", 
    icon: Map 
  },
  { 
    title: "Notes", 
    url: "/notes", 
    icon: BookOpen 
  },
  { 
    title: "Sticky Notes", 
    url: "/sticky-notes", 
    icon: StickyNote 
  },
  { 
    title: "Study Plan", 
    url: "/study-plan", 
    icon: CalendarDays 
  },
  { 
    title: "Settings", 
    url: "/settings", 
    icon: Settings 
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar 
      collapsible="icon"
      className="mt-14 sm:mt-16 border-r border-border bg-surface"
    >
      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted px-3 py-2">
            {!isCollapsed && "Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.url);
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      className={`
                        w-full justify-start gap-3 px-3 py-2 rounded-lg transition-all duration-200
                        ${active 
                          ? "bg-accent text-white shadow-glow" 
                          : "text-muted hover:text-text hover:bg-secondary"
                        }
                      `}
                    >
                      <NavLink to={item.url}>
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {!isCollapsed && (
                          <span className="font-medium">
                            {item.title}
                            {item.isNew && (
                              <Plus className="w-3 h-3 inline ml-1 opacity-60" />
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Recent Sessions */}
        {!isCollapsed && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted px-3 py-2">
              Recent Sessions
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {["Math Notes - Chapter 5", "Biology Diagrams", "History Quiz"].map((session, index) => (
                  <SidebarMenuItem key={index}>
                    <SidebarMenuButton className="w-full justify-start gap-3 px-3 py-2 text-sm text-muted hover:text-text hover:bg-secondary rounded-lg">
                      <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{session}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}