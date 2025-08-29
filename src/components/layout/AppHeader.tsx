import { Search, Sun, Moon, User, StickyNote, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useContext } from "react";
import { AuthContext } from "@/providers/AuthProvider";

interface AppHeaderProps {
  onOpenSticky?: () => void;
}

export function AppHeader({ onOpenSticky }: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const auth = useContext(AuthContext);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 sm:h-16 border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70 overflow-x-hidden">
      <div className="w-full max-w-full mx-auto h-full flex items-center gap-3 px-3 sm:px-4 min-w-0">
        <SidebarTrigger />

        {/* Logo */}
        <div className="flex items-center gap-2 font-semibold text-lg">
          <img
            src="/Snapstudy.png"
            alt="SnapStudy logo"
            className="w-8 h-8 rounded-lg select-none object-contain"
            loading="eager"
            decoding="async"
          />
          <span className="hidden sm:inline text-text">SnapStudy</span>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md relative hidden xs:flex min-w-0 overflow-hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <Input
            placeholder="Search or ask anything..."
            className="pl-10 bg-surface border-border focus-ring"
          />
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-4">
          {/* Mobile sticky notes trigger */}
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenSticky}
            className="sm:hidden"
            aria-label="Open Sticky Notes"
          >
            <StickyNote className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSticky}
            className="gap-2 hidden sm:flex"
          >
            <StickyNote className="w-4 h-4" />
            <span className="hidden sm:inline">Sticky Notes</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="focus-ring"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>

          {/* Avatar dropdown (last) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full border border-border w-8 h-8 overflow-hidden bg-surface focus-ring">
                <Avatar className="w-8 h-8">
                  <AvatarImage src="" alt="User" />
                  <AvatarFallback className="bg-surface">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {auth?.user ? (
                <>
                  <DropdownMenuItem>
                    <Link to="/settings" className="w-full">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); auth.logout(); }} className="cursor-pointer">
                    <div className="flex items-center gap-2 w-full">
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </div>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem>
                  <Link to="/login" className="w-full">Login</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}